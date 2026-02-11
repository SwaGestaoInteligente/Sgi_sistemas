using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Financeiro;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Services;

public class IndicesEconomicosJob : BackgroundService
{
    private static readonly CultureInfo PtBr = new("pt-BR");
    private const string BaseUrl = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.";
    private static readonly TimeSpan IntervaloAtualizacao = TimeSpan.FromHours(12);

    private static readonly IndiceSerieConfig[] Series =
    [
        new IndiceSerieConfig("IPCA", 433),
        new IndiceSerieConfig("IGPM", 189),
        new IndiceSerieConfig("INPC", 188),
        new IndiceSerieConfig("CDI", 4391)
    ];

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<IndicesEconomicosJob> _logger;

    public IndicesEconomicosJob(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpClientFactory,
        ILogger<IndicesEconomicosJob> logger)
    {
        _scopeFactory = scopeFactory;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await AtualizarIndicesAsync(stoppingToken);

        using var timer = new PeriodicTimer(IntervaloAtualizacao);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await AtualizarIndicesAsync(stoppingToken);
        }
    }

    private async Task AtualizarIndicesAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SgiDbContext>();
            var client = _httpClientFactory.CreateClient();

            var fim = DateTime.UtcNow.Date;
            var inicio = new DateTime(fim.Year, fim.Month, 1).AddMonths(-24);

            foreach (var serie in Series)
            {
                var itens = await BuscarSerieAsync(client, serie, inicio, fim, stoppingToken);
                if (itens.Count == 0)
                {
                    continue;
                }

                var atualizados = 0;
                foreach (var item in itens)
                {
                    var existente = await db.IndicesEconomicos
                        .FirstOrDefaultAsync(
                            i => i.Tipo == serie.Tipo && i.Ano == item.Ano && i.Mes == item.Mes,
                            stoppingToken);

                    if (existente is null)
                    {
                        db.IndicesEconomicos.Add(new IndiceEconomico
                        {
                            Id = Guid.NewGuid(),
                            Tipo = serie.Tipo,
                            Ano = item.Ano,
                            Mes = item.Mes,
                            ValorPercentual = item.ValorPercentual,
                            Fonte = $"BCB-SGS:{serie.SerieId}",
                            AtualizadoEm = DateTime.UtcNow
                        });
                        atualizados++;
                        continue;
                    }

                    if (existente.ValorPercentual != item.ValorPercentual)
                    {
                        existente.ValorPercentual = item.ValorPercentual;
                        existente.Fonte = $"BCB-SGS:{serie.SerieId}";
                        existente.AtualizadoEm = DateTime.UtcNow;
                        atualizados++;
                    }
                }

                if (atualizados > 0)
                {
                    await db.SaveChangesAsync(stoppingToken);
                }

                _logger.LogInformation(
                    "IndicesEconomicos: {Tipo} atualizados={Atualizados} periodo {Inicio:yyyy-MM}..{Fim:yyyy-MM}",
                    serie.Tipo,
                    atualizados,
                    inicio,
                    fim);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao atualizar indices economicos.");
        }
    }

    private async Task<List<IndiceMensal>> BuscarSerieAsync(
        HttpClient client,
        IndiceSerieConfig serie,
        DateTime inicio,
        DateTime fim,
        CancellationToken stoppingToken)
    {
        var url =
            $"{BaseUrl}{serie.SerieId}/dados?formato=json&dataInicial={inicio:dd/MM/yyyy}&dataFinal={fim:dd/MM/yyyy}";

        var dados = await client.GetFromJsonAsync<List<BcbSerieItem>>(url, stoppingToken)
                    ?? new List<BcbSerieItem>();

        var itens = new List<IndiceMensal>();
        foreach (var dado in dados)
        {
            if (!TryParseData(dado.Data, out var data) ||
                !TryParseDecimal(dado.Valor, out var valor))
            {
                continue;
            }

            itens.Add(new IndiceMensal(data.Year, data.Month, data, valor));
        }

        return itens
            .GroupBy(i => new { i.Ano, i.Mes })
            .Select(g => g.OrderBy(x => x.DataReferencia).Last())
            .ToList();
    }

    private static bool TryParseData(string raw, out DateTime data)
        => DateTime.TryParseExact(raw, "dd/MM/yyyy", PtBr, DateTimeStyles.None, out data);

    private static bool TryParseDecimal(string raw, out decimal valor)
        => decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out valor)
           || decimal.TryParse(raw, NumberStyles.Any, PtBr, out valor);

    private sealed record IndiceSerieConfig(string Tipo, int SerieId);

    private sealed record IndiceMensal(
        int Ano,
        int Mes,
        DateTime DataReferencia,
        decimal ValorPercentual);

    private sealed record BcbSerieItem(
        [property: JsonPropertyName("data")] string Data,
        [property: JsonPropertyName("valor")] string Valor);
}

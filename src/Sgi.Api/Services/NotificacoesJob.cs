using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Services;

public class NotificacoesJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<NotificacoesJob> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(3);

    public NotificacoesJob(IServiceProvider services, ILogger<NotificacoesJob> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessarAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar notificacoes.");
            }

            try
            {
                await Task.Delay(_interval, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                // Encerrando.
            }
        }
    }

    private async Task ProcessarAsync(CancellationToken ct)
    {
        await using var scope = _services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SgiDbContext>();

        var configs = await db.NotificacoesConfig.AsNoTracking()
            .Where(c => c.Ativo)
            .ToListAsync(ct);

        if (configs.Count == 0)
        {
            return;
        }

        var agora = DateTime.UtcNow;
        foreach (var config in configs)
        {
            if (config.Tipo.Contains("conta_pagar", StringComparison.OrdinalIgnoreCase))
            {
                await GerarAlertasContasPagarAsync(db, config, agora, ct);
            }

            if (config.Tipo.Contains("cobranca_unidade", StringComparison.OrdinalIgnoreCase))
            {
                await GerarAlertasCobrancasUnidadeAsync(db, config, agora, ct);
            }
        }
    }

    private static async Task GerarAlertasContasPagarAsync(
        SgiDbContext db,
        NotificacaoConfig config,
        DateTime agora,
        CancellationToken ct)
    {
        var dias = config.DiasAntesVencimento ?? 3;
        var limite = config.LimiteValor;
        var dataLimite = agora.Date.AddDays(dias);

        var contas = await db.LancamentosFinanceiros.AsNoTracking()
            .Where(l => l.OrganizacaoId == config.OrganizacaoId)
            .Where(l => l.Tipo == "pagar" && (l.Situacao == "aberto" || l.Situacao == "aprovado"))
            .Where(l => l.DataVencimento.HasValue && l.DataVencimento.Value.Date <= dataLimite)
            .ToListAsync(ct);

        foreach (var conta in contas)
        {
            if (limite.HasValue && conta.Valor < limite.Value)
            {
                continue;
            }

            var titulo = "Conta a pagar vencendo";
            var mensagem = $"{conta.Descricao} vence em {conta.DataVencimento:dd/MM/yyyy}";

            await CriarEventoSeNovoAsync(db, config, titulo, mensagem, ct);
        }
    }

    private static async Task GerarAlertasCobrancasUnidadeAsync(
        SgiDbContext db,
        NotificacaoConfig config,
        DateTime agora,
        CancellationToken ct)
    {
        var dias = config.DiasAntesVencimento ?? 3;
        var limite = config.LimiteValor;
        var dataLimite = agora.Date.AddDays(dias);

        var cobrancas = await db.UnidadesCobrancas.AsNoTracking()
            .Where(c => c.OrganizacaoId == config.OrganizacaoId)
            .Where(c => c.Status == "ABERTA" || c.Status == "ATRASADA")
            .Where(c => c.Vencimento.Date <= dataLimite)
            .ToListAsync(ct);

        foreach (var cobranca in cobrancas)
        {
            if (limite.HasValue && cobranca.Valor < limite.Value)
            {
                continue;
            }

            var titulo = "Cobranca de unidade vencendo";
            var mensagem = $"{cobranca.Descricao} vence em {cobranca.Vencimento:dd/MM/yyyy}";
            await CriarEventoSeNovoAsync(db, config, titulo, mensagem, ct);
        }
    }

    private static async Task CriarEventoSeNovoAsync(
        SgiDbContext db,
        NotificacaoConfig config,
        string titulo,
        string mensagem,
        CancellationToken ct)
    {
        var existe = await db.NotificacoesEventos.AsNoTracking()
            .Where(n => n.OrganizacaoId == config.OrganizacaoId)
            .Where(n => n.Tipo == config.Tipo && n.Mensagem == mensagem)
            .Where(n => n.CriadoEm >= DateTime.UtcNow.AddHours(-24))
            .AnyAsync(ct);

        if (existe)
        {
            return;
        }

        var evento = new NotificacaoEvento
        {
            Id = Guid.NewGuid(),
            OrganizacaoId = config.OrganizacaoId,
            Tipo = config.Tipo,
            Canal = config.Canal,
            Titulo = titulo,
            Mensagem = mensagem,
            CriadoEm = DateTime.UtcNow,
            DestinatariosJson = config.DestinatariosJson
        };

        db.NotificacoesEventos.Add(evento);
        await db.SaveChangesAsync(ct);
    }
}

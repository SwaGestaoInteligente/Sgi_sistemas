using Microsoft.EntityFrameworkCore;
using Sgi.Domain.Core;
using Sgi.Infrastructure.Data;

namespace Sgi.Api.Services;

public record NotificacoesProcessamentoResumo(
    Guid? OrganizacaoId,
    int ConfiguracoesAtivas,
    int ContasAnalisadas,
    int CobrancasAnalisadas,
    int EventosGerados,
    DateTime ProcessadoEmUtc);

public class NotificacoesProcessor
{
    private readonly SgiDbContext _db;

    public NotificacoesProcessor(SgiDbContext db)
    {
        _db = db;
    }

    public async Task<NotificacoesProcessamentoResumo> ProcessarAsync(
        Guid? organizacaoId = null,
        CancellationToken ct = default)
    {
        var configsQuery = _db.NotificacoesConfig.AsNoTracking().Where(c => c.Ativo);
        if (organizacaoId.HasValue && organizacaoId.Value != Guid.Empty)
        {
            configsQuery = configsQuery.Where(c => c.OrganizacaoId == organizacaoId.Value);
        }

        var configs = await configsQuery.ToListAsync(ct);
        if (configs.Count == 0)
        {
            return new NotificacoesProcessamentoResumo(
                organizacaoId,
                0,
                0,
                0,
                0,
                DateTime.UtcNow);
        }

        var agora = DateTime.UtcNow;
        var contasAnalisadas = 0;
        var cobrancasAnalisadas = 0;
        var eventosGerados = 0;

        foreach (var config in configs)
        {
            if (config.Tipo.Contains("conta_pagar", StringComparison.OrdinalIgnoreCase))
            {
                var (analisadas, geradas) =
                    await GerarAlertasContasPagarAsync(config, agora, ct);
                contasAnalisadas += analisadas;
                eventosGerados += geradas;
            }

            if (config.Tipo.Contains("cobranca_unidade", StringComparison.OrdinalIgnoreCase))
            {
                var (analisadas, geradas) =
                    await GerarAlertasCobrancasUnidadeAsync(config, agora, ct);
                cobrancasAnalisadas += analisadas;
                eventosGerados += geradas;
            }
        }

        return new NotificacoesProcessamentoResumo(
            organizacaoId,
            configs.Count,
            contasAnalisadas,
            cobrancasAnalisadas,
            eventosGerados,
            DateTime.UtcNow);
    }

    private async Task<(int Analisadas, int Geradas)> GerarAlertasContasPagarAsync(
        NotificacaoConfig config,
        DateTime agora,
        CancellationToken ct)
    {
        var dias = config.DiasAntesVencimento ?? 3;
        var limite = config.LimiteValor;
        var dataLimite = agora.Date.AddDays(dias);

        var contas = await _db.LancamentosFinanceiros.AsNoTracking()
            .Where(l => l.OrganizacaoId == config.OrganizacaoId)
            .Where(l => l.Tipo == "pagar" && (l.Situacao == "aberto" || l.Situacao == "aprovado"))
            .Where(l => l.DataVencimento.HasValue && l.DataVencimento.Value.Date <= dataLimite)
            .ToListAsync(ct);

        var gerados = 0;
        foreach (var conta in contas)
        {
            if (limite.HasValue && conta.Valor < limite.Value)
            {
                continue;
            }

            var titulo = "Conta a pagar vencendo";
            var mensagem = $"{conta.Descricao} vence em {conta.DataVencimento:dd/MM/yyyy}";

            if (await CriarEventoSeNovoAsync(config, titulo, mensagem, ct))
            {
                gerados++;
            }
        }

        return (contas.Count, gerados);
    }

    private async Task<(int Analisadas, int Geradas)> GerarAlertasCobrancasUnidadeAsync(
        NotificacaoConfig config,
        DateTime agora,
        CancellationToken ct)
    {
        var dias = config.DiasAntesVencimento ?? 3;
        var limite = config.LimiteValor;
        var dataLimite = agora.Date.AddDays(dias);

        var cobrancas = await _db.UnidadesCobrancas.AsNoTracking()
            .Where(c => c.OrganizacaoId == config.OrganizacaoId)
            .Where(c => c.Status == "ABERTA" || c.Status == "ATRASADA")
            .Where(c => c.Vencimento.Date <= dataLimite)
            .ToListAsync(ct);

        var gerados = 0;
        foreach (var cobranca in cobrancas)
        {
            if (limite.HasValue && cobranca.Valor < limite.Value)
            {
                continue;
            }

            var titulo = "Cobranca de unidade vencendo";
            var mensagem = $"{cobranca.Descricao} vence em {cobranca.Vencimento:dd/MM/yyyy}";
            if (await CriarEventoSeNovoAsync(config, titulo, mensagem, ct))
            {
                gerados++;
            }
        }

        return (cobrancas.Count, gerados);
    }

    private async Task<bool> CriarEventoSeNovoAsync(
        NotificacaoConfig config,
        string titulo,
        string mensagem,
        CancellationToken ct)
    {
        var existe = await _db.NotificacoesEventos.AsNoTracking()
            .Where(n => n.OrganizacaoId == config.OrganizacaoId)
            .Where(n => n.Tipo == config.Tipo && n.Canal == config.Canal && n.Mensagem == mensagem)
            .Where(n => n.CriadoEm >= DateTime.UtcNow.AddHours(-24))
            .AnyAsync(ct);

        if (existe)
        {
            return false;
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

        _db.NotificacoesEventos.Add(evento);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

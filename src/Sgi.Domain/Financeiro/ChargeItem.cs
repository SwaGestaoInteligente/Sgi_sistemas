namespace Sgi.Domain.Financeiro;

/// <summary>
/// Item que pode ser cobrado de uma pessoa/unidade em uma organização,
/// como taxa de salão de festas, tag de acesso, multa, etc.
/// Sempre vinculado a uma conta de receita no plano de contas.
/// </summary>
public class ChargeItem
{
    public Guid Id { get; set; }
    public Guid OrganizacaoId { get; set; }

    /// <summary>
    /// Nome amigável do item (ex.: "Reserva salão de festas", "Tag de acesso extra").
    /// </summary>
    public string Nome { get; set; } = string.Empty;

    /// <summary>
    /// Tipo geral de item cobrado (AreaComum, TagAcesso, Multa, Outros).
    /// Usado apenas para organização / filtros.
    /// </summary>
    public string Tipo { get; set; } = string.Empty;

    /// <summary>
    /// Categoria financeira de receita à qual este item está vinculado.
    /// </summary>
    public Guid FinanceCategoryId { get; set; }

    /// <summary>
    /// Valor padrão sugerido ao usar o item. Pode ser nulo quando o valor
    /// deve ser sempre informado manualmente.
    /// </summary>
    public decimal? ValorPadrao { get; set; }

    /// <summary>
    /// Indica se o usuário pode alterar o valor na hora do lançamento/cobrança.
    /// </summary>
    public bool PermiteAlterarValor { get; set; }

    /// <summary>
    /// Indica se o uso deste item normalmente exige uma reserva aprovada
    /// (ex.: salão de festas).
    /// </summary>
    public bool ExigeReserva { get; set; }

    /// <summary>
    /// Quando verdadeiro, o uso deste item deve gerar automaticamente
    /// um lançamento financeiro de "receber". O fluxo detalhado será
    /// implementado nas telas/serviços que utilizarem o item.
    /// </summary>
    public bool GeraCobrancaAutomatica { get; set; }

    public string? DescricaoOpcional { get; set; }

    public bool Ativo { get; set; } = true;
}


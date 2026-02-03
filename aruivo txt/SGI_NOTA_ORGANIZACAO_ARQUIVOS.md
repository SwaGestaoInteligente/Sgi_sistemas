# SGI — Organização dos arquivos (recomendação)

## Arquivo “fonte da verdade” (para colar no App.tsx)
- **App.tsx_COMPLETO_unificado.txt** (gerado agora)
  - Junção do **App_atualizado_parte_1.txt + App_atualizado_parte_2.txt**.

## Manter (úteis)
- **RELATORIO_DO_DIA.txt**: histórico do que foi corrigido e próximos passos.
- **doc base.txt**: visão/escopo do produto (documento base).

## Jogar fora / arquivar (duplicados ou pedaços soltos)
- **código de 1 a 1908 o 1909 esta vazi.txt** (pedaço antigo)
- **de 1910 a 3747.txt** (pedaço antigo — já está dentro do unificado)
- **meleca.txt** (recorte do financeiro — duplicado)
- **01-02-26.txt** (recorte — duplicado)
- **all-code.txt** (se for dump antigo)
- **sgi abri.txt** (se for só passo-a-passo, pode ficar junto do relatório)

## Checklist rápido (pra não dar erro de novo)
1) No App.tsx, a **primeira linha tem que ser** `import ...` (nada de texto solto acima).
2) Salvar arquivos em **UTF-8**.
3) Backend na porta **7000** e front no **5173**.

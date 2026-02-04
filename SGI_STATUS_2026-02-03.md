# SGI / sgi-web — Status do Projeto (snapshot)

Data: 2026-02-03

## 1) O que você queria (alinhamento)
- **Não apagar e refazer do zero.**
- **Tirar a “poluição visual” e deixar o App leve**, organizado por módulos.
- **Separar o App.tsx (orquestrador) das telas (views)**, sem perder o código grande que já existe.
- **Distribuir o código antigo** em arquivos certos (Pessoas, Unidades, Financeiro), deixando o que ainda não for usar **desabilitado** (mas guardado e pronto pra reativar).

## 2) Estrutura atual (como está ficando)
Pelo que você mostrou, hoje o front está assim:

```
sgi-web/
  src/
    hooks/
      useAuth.ts (AuthProvider / useAuth)
    pages/
      App.tsx
      LoginPage.tsx
      views/
        PessoasView.tsx
        FinanceiroView.tsx
        UnidadesView.tsx
    api.ts
    main.tsx
    styles.css
```

### O que já foi criado/movido
- ✅ `src/views/PessoasView.tsx` (tela de pessoas) — **criado/movido**
- ✅ `src/views/UnidadesView.tsx` — **criado** (modelo simples por enquanto)
- ✅ `src/views/FinanceiroView.tsx` — **arquivo criado** (precisa receber o conteúdo completo)
- ✅ `src/pages/App.tsx` — **ficou menor**, mas agora precisa voltar a “colar” os módulos do jeito certo.

## 3) O que estava no App.tsx antigo (código grande) e para onde ele deve ir
O App.tsx antigo tinha muita coisa dentro dele:
- PessoasView (form + lista)
- UnidadesView (CRUD básico)
- FinanceiroView (abas: contas, contas a pagar, contas a receber, itens cobrados, categorias, relatórios)
- Navegação (menu lateral + botões)
- Seleção de organização (organizacaoSelecionada)
- Dashboard (resumo)

✅ A direção certa é esta:
- **App.tsx**: autenticação, seleção de organização, menu e roteamento/aba.
- **Views**: regra de negócio e UI de cada módulo.

## 4) Problemas reais que já aparecem (pra corrigir sem “bagunçar”)

### 4.1) `organizacaoSelecionada` no App.tsx atual
O App.tsx que você mostrou usa:
```ts
const { token, organizacaoSelecionada } = useAuth();
```
Isso **só funciona** se o seu `useAuth()` realmente devolve `organizacaoSelecionada`.

➡️ Se o `useAuth()` não devolve isso, o sublinhado vermelho é esperado.
**Solução correta**: `organizacaoSelecionada` deve morar:
- OU no **estado do App** (mais simples agora),
- OU no **AuthProvider** (mais avançado, depois).

### 4.2) Bug de array em 2 lugares (vai quebrar em runtime/compile)
No código antigo existe este erro:
```ts
setUnidades((prev) => [.prev, criada]);
```
O certo é:
```ts
setUnidades((prev) => [...prev, criada]);
```

O mesmo padrão pode aparecer em outros `setX((prev) => [.prev, ...])` do Financeiro.
➡️ Isso precisa ser corrigido quando colarmos o Financeiro/Unidades nos arquivos.

## 5) O que falta (lista clara)
### FALTA 1 — “Distribuição” do código antigo (sem deletar)
- Colar o conteúdo completo do **FinanceiroView** dentro de `src/views/FinanceiroView.tsx`.
- Colar o conteúdo completo do **UnidadesView** dentro de `src/views/UnidadesView.tsx` (e corrigir o bug do `...prev`).

### FALTA 2 — App.tsx voltar a ser o “orquestrador” completo (leve, mas completo)
- App deve ter:
  - token (do useAuth)
  - **estado** de `organizacaoSelecionada` (por enquanto no App)
  - **estado** de `view` (qual módulo está aberto)
  - menu simples (Resumo, Pessoas, Unidades, Financeiro etc.)
  - renderizar a view certa:
    - PessoasView
    - UnidadesView
    - FinanceiroView
  - e o que não estiver pronto, deixar **desabilitado** (comentado/feature flag).

### FALTA 3 — “Desabilitado, mas pronto” (do jeito que você pediu)
Criar um arquivo de **flags** (ex.: `src/shared/features.ts`) com algo assim:
```ts
export const FEATURES = {
  dashboard: true,
  pessoas: true,
  unidades: true,
  financeiro: true,
  fornecedores: false,
  veiculos: false,
  pets: false
} as const;
```
E no App.tsx só mostra no menu o que estiver `true`.

## 6) Próxima execução (ordem de trabalho — sem pular etapa)
**PASSO A — App.tsx estabilizar (sem erro vermelho)**
1) Garantir que `organizacaoSelecionada` existe (estado no App, por enquanto).
2) App renderiza **PessoasView/UnidadesView/FinanceiroView** sem quebrar.

**PASSO B — UnidadesView ficar funcional**
3) Colar CRUD do UnidadesView antigo no `src/views/UnidadesView.tsx`.
4) Corrigir `setUnidades((prev) => [...prev, criada])`.

**PASSO C — FinanceiroView ficar funcional**
5) Colar o FinanceiroView antigo no `src/views/FinanceiroView.tsx`.
6) Corrigir os `setX((prev) => [...prev, novo])`.
7) Garantir imports: `useAuth`, `api`, tipos (ou `any` temporário).

## 7) O que já está guardado (pra você não perder nada)
- O “código grande” do Financeiro e Unidades **existe** no App antigo (você tem ele em arquivo/trechos).
- A estratégia é **não apagar**, e sim **mover** para `src/views/` e deixar o App leve.

---

## Checklist rápido (pra você validar em 30 segundos)
- [ ] `src/views/PessoasView.tsx` existe e exporta default
- [ ] `src/views/UnidadesView.tsx` existe
- [ ] `src/views/FinanceiroView.tsx` existe
- [ ] `App.tsx` importa as 3 views e escolhe qual renderizar
- [ ] `organizacaoSelecionada` está definido (estado no App ou no AuthProvider)
- [ ] Corrigido: `setX((prev) => [...prev, novo])`

## 8) Registro â€” GitHub (2026-02-04)
- Pull precisou mover arquivos locais nÃ£o rastreados: `start-api.bat` e `start-web.bat` foram movidos para `backup-local/`.
- Depois disso, `git pull --ff-only` concluiu normalmente.
- A pasta `condo-fullstack/` voltou vinda do repositÃ³rio (mesmo tendo sido apagada localmente).

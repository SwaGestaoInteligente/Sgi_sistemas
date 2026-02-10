# Test Report

- Timestamp: 2026-02-09T22:22:48
- Pass: 11
- Fail: 2

| Test | Status | Detail |
| --- | --- | --- |
| API up (Swagger) | PASS | Status 200 |
| Web up | PASS | Status 200 |
| Login admin | PASS | Token recebido |
| Listar organizacoes | PASS | Total 2 |
| Criar bloco | PASS | Id 24cd9a68-b6ac-48b5-b612-107ac0dc369c |
| Criar unidade | PASS | Id 4458d7c2-a782-4b55-81d3-43086a2b1c8c |
| Criar pessoa | PASS | Id 9e5c5de4-fd35-4844-a92b-c0c80770d54c |
| Criar vinculo | PASS | Id f89e9e5c-a248-41e8-87a3-5ab573b5c38e |
| Listar vinculos por pessoa | PASS | Qtd 2 |
| Cleanup: remover vinculo | FAIL | Response status code does not indicate success: 404 (Not Found). |
| Cleanup: remover pessoa | FAIL | Response status code does not indicate success: 404 (Not Found). |
| Cleanup: arquivar unidade | PASS | OK |
| Cleanup: arquivar bloco | PASS | OK |

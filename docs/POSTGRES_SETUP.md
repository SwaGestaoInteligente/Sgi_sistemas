# Postgres local (dev)

Por padrao o projeto usa SQLite. Para testar Postgres localmente:

1. Suba o container.
```
docker compose up -d
```
2. Defina o provider.
```
Database:Provider=postgres
```
3. Ajuste a connection string (exemplo).
```
ConnectionStrings:PostgresConnection=Host=localhost;Port=5432;Database=sgi;Username=sgi;Password=sgi;Pooling=true;
```
4. Rode as migrations.
```
dotnet ef database update -p src/Sgi.Infrastructure -s src/Sgi.Api
```

Para voltar ao SQLite:

1. Defina o provider.
```
Database:Provider=sqlite
```
2. Garanta a connection string padrao.
```
ConnectionStrings:DefaultConnection=Data Source=sgi.db
```

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY src/Sgi.Api/Sgi.Api.csproj src/Sgi.Api/
COPY src/Sgi.Infrastructure/Sgi.Infrastructure.csproj src/Sgi.Infrastructure/
COPY src/Sgi.Domain/Sgi.Domain.csproj src/Sgi.Domain/
RUN dotnet restore src/Sgi.Api/Sgi.Api.csproj

COPY src/ src/
WORKDIR /src/src/Sgi.Api
RUN dotnet publish Sgi.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "Sgi.Api.dll"]

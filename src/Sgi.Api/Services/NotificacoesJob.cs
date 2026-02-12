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
        var processor = scope.ServiceProvider.GetRequiredService<NotificacoesProcessor>();
        await processor.ProcessarAsync(null, ct);
    }
}

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get('live')
  @ApiOperation({ summary: 'Check that the HTTP process is responsive' })
  @ApiResponse({ status: 200, description: 'HTTP process is responsive' })
  live() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Check application and PostgreSQL database health' })
  @ApiResponse({ status: 200, description: 'Service and database healthy' })
  @ApiResponse({ status: 503, description: 'Database connectivity failed' })
  async check() {
    const dbHealthy = await this.prisma.checkHealth();
    const payload = {
      status: dbHealthy ? 'ok' : 'degraded',
      database: dbHealthy ? 'connected' : 'disconnected',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    if (!dbHealthy) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}

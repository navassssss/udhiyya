import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LegacyOrganizationRoutesGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate() {
    if (this.config.get<string>('AUTH_MODE') === 'brocoders') {
      throw new NotFoundException('Route not available');
    }
    return true;
  }
}

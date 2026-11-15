import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SupabaseIdentityService } from '../../auth/supabase-identity.service.js';
import { AuthGuard } from '@nestjs/passport';
import {
  IS_PUBLIC_KEY,
  REQUIRE_VERIFIED_EMAIL_KEY,
} from '../constants/auth.constants.js';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly supabaseIdentity: SupabaseIdentityService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    if (this.configService.get('AUTH_MODE') === 'supabase') {
      request.user = await this.supabaseIdentity.authenticate(
        request.headers.authorization,
      );
    } else if (!(await super.canActivate(context))) {
      return false;
    }
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const explicitEmailPolicy = this.reflector.getAllAndOverride<
      boolean | undefined
    >(REQUIRE_VERIFIED_EMAIL_KEY, [context.getHandler(), context.getClass()]);
    const globalRequireVerified =
      this.configService.get<boolean>('auth.requireEmailVerification') ?? true;

    const mustBeVerified =
      explicitEmailPolicy !== undefined
        ? explicitEmailPolicy
        : globalRequireVerified;

    if (
      mustBeVerified &&
      !user.emailVerifiedAt &&
      !(explicitEmailPolicy !== true && user.emailVerificationExempt)
    ) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email verification is required to access this resource',
      });
    }

    return true;
  }

  override handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser,
  ): TUser {
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Invalid or expired authentication token');
    }
    return user;
  }
}

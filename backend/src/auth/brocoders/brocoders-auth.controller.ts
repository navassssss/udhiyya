import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Post,
  Get,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { AuthService } from '../auth.service.js';
import { GoogleOAuthService } from '../google-oauth.service.js';
import {
  CreateRegularUserDto,
  DirectGoogleDto,
  EmailDto,
  EmailHashDto,
  EmailLoginDto,
  EmailRegisterDto,
  EmailResetDto,
} from './brocoders-auth.dto.js';
import {
  BrocodersProfileService,
  nameParts,
} from './brocoders-profile.service.js';
import { BrocodersEmailChangeService } from './brocoders-email-change.service.js';

type RequestMetadata = { ip?: string; headers: { 'user-agent'?: string } };
function client(request: RequestMetadata) {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.headers['user-agent'] ?? null,
  };
}

@Controller('auth')
export class BrocodersAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleOAuthService,
    private readonly profiles: BrocodersProfileService,
    private readonly emailChange: BrocodersEmailChangeService,
  ) {}

  @Public()
  @Post(['email/register', 'register'])
  @HttpCode(204)
  async register(
    @Body() input: EmailRegisterDto,
    @Req() request: RequestMetadata,
  ) {
    const names = nameParts(input);
    await this.auth.register(
      {
        name: names.name,
        email: input.email,
        password: input.password,
        confirmPassword: input.password,
      },
      client(request),
      { firstName: names.firstName, lastName: names.lastName },
    );
  }

  @Public()
  @Post(['email/confirm', 'verify-email'])
  @HttpCode(204)
  async confirm(@Body() input: EmailHashDto, @Req() request: RequestMetadata) {
    const token = input.hash || input.token;
    if (!token) throw new BadRequestException('Verification token or hash is required');
    await this.auth.verifyEmail(token, client(request));
  }

  @Post('email/change')
  @HttpCode(204)
  async requestEmailChange(
    @Body() input: EmailLoginDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.emailChange.request(actor.id, input.email, input.password);
  }

  @Public()
  @Post('email/confirm/new')
  @HttpCode(204)
  async confirmNew(@Body() input: EmailHashDto) {
    const token = input.hash || input.token;
    if (!token) throw new BadRequestException('Verification token or hash is required');
    await this.emailChange.confirm(token);
  }

  @Public()
  @Post(['email/login', 'login'])
  @HttpCode(200)
  async login(@Body() input: EmailLoginDto, @Req() request: RequestMetadata) {
    const bundle = await this.auth.login(
      { email: input.email, password: input.password, useCookies: false },
      client(request),
    );
    return this.profiles.session(bundle);
  }

  @Public()
  @Post(['google/login', 'google'])
  @HttpCode(200)
  async googleLogin(
    @Body() input: DirectGoogleDto,
    @Req() request: RequestMetadata,
  ) {
    const identity = await this.google
      .verifyGoogleIdToken(input.idToken)
      .catch((error: unknown) => {
        if (error instanceof HttpException) throw error;
        throw new UnauthorizedException('Invalid or expired Google credential');
      });
    const bundle = await this.google.authenticateVerifiedGoogleIdentity(
      identity,
      client(request),
    );
    return this.profiles.session(bundle);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Headers('authorization') authorization: string | undefined,
    @Req() request: RequestMetadata,
  ) {
    const token = /^Bearer (\S+)$/i.exec(authorization ?? '')?.[1];
    if (!token || token.length > 512)
      throw new UnauthorizedException('A refresh token is required');
    return this.profiles.session(
      await this.auth.refreshTokens(token, client(request)),
    );
  }

  @Get('me')
  me(@CurrentUser() actor: AuthenticatedUser) {
    return this.profiles.profile(actor.id);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestMetadata,
  ) {
    await this.auth.logout(actor, client(request));
  }

  @Public()
  @Post(['forgot/password', 'forgot-password'])
  @HttpCode(204)
  async forgot(@Body() input: EmailDto, @Req() request: RequestMetadata) {
    await this.auth.forgotPassword(input.email, client(request));
  }

  @Public()
  @Post(['reset/password', 'reset-password'])
  @HttpCode(204)
  async reset(@Body() input: EmailResetDto, @Req() request: RequestMetadata) {
    const token = input.hash || input.token;
    if (!token) throw new BadRequestException('Password reset token or hash is required');
    await this.auth.resetPassword(
      {
        token,
        newPassword: input.password,
        confirmPassword: input.password,
      },
      client(request),
    );
  }
}

@Controller('users')
@Roles('super_admin', 'admin')
export class BrocodersAdminUsersController {
  constructor(private readonly profiles: BrocodersProfileService) {}

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateRegularUserDto,
  ) {
    return this.profiles.createRegularUser(actor.id, input);
  }
}

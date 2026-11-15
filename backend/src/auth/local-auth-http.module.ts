import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthModule } from './auth.module.js';

@Module({ imports: [AuthModule], controllers: [AuthController] })
export class LocalAuthHttpModule {}

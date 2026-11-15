import { Type } from 'class-transformer';
import {
  Equals,
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class EmailDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class EmailLoginDto extends EmailDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class EmailRegisterDto extends EmailDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

export class EmailHashDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(256)
  hash?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(256)
  token?: string;
}

export class EmailResetDto extends EmailHashDto {
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

export class DirectGoogleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  idToken!: string;
}

class ActiveStatusDto {
  @Equals(1)
  id!: 1;
}

class RegularRoleDto {
  @Equals(2)
  id!: 2;
}

export class CreateRegularUserDto extends EmailRegisterDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ActiveStatusDto)
  status!: ActiveStatusDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RegularRoleDto)
  role!: RegularRoleDto;
}

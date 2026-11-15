import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsUUID,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ProgrammeListQuery } from '../programmes/programmes.dto.js';

export class OrganisationContactDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class CreatePlatformOrganisationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  locality!: string;

  @ValidateNested()
  @Type(() => OrganisationContactDto)
  contact!: OrganisationContactDto;
}

export class UpdatePlatformOrganisationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  locality?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganisationContactDto)
  contact?: OrganisationContactDto;

  @IsOptional()
  @IsIn(['onboarding', 'active', 'suspended', 'closed'])
  status?: 'onboarding' | 'active' | 'suspended' | 'closed';
}

export class PlatformOrganisationQuery extends ProgrammeListQuery {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class InviteCommitteeAdminDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export const enhancementIds = [
  'EF-01',
  'EF-02',
  'EF-03',
  'EF-04',
  'EF-05',
] as const;

export class PlatformFeaturesDto {
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsIn(enhancementIds, { each: true })
  enabledFeatures!: (typeof enhancementIds)[number][];
}

export class PlatformAuditQuery extends ProgrammeListQuery {
  @IsOptional()
  @IsUUID()
  organisationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;
}

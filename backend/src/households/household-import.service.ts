import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { fromBuffer } from 'yauzl';
import { CreateHouseholdDto } from './households.dto.js';

export const MAX_HOUSEHOLD_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_EXPANDED_WORKBOOK_BYTES = 16 * 1024 * 1024;
const MAX_ROWS = 1000;
const columns = ['name', 'address', 'email', 'phone'];

type RowError = { row: number; field: string; message: string };

function flatten(
  errors: ValidationError[],
  row: number,
  prefix = '',
): RowError[] {
  return errors.flatMap((error) => {
    const field = prefix + error.property;
    return [
      ...Object.values(error.constraints ?? {}).map((message) => ({
        row,
        field,
        message,
      })),
      ...flatten(error.children ?? [], row, field + '.'),
    ];
  });
}

// Validate every entry before passing the workbook to the spreadsheet parser.
function validateArchive(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) {
          reject(error ?? new Error('Invalid workbook archive'));
          return;
        }

        let expanded = 0;
        let entries = 0;
        const fail = (cause: Error) => {
          zip.close();
          reject(cause);
        };

        zip.once('error', fail);
        zip.once('end', () => {
          zip.close();
          resolve();
        });
        zip.on('entry', (entry) => {
          entries += 1;
          expanded += entry.uncompressedSize;
          if (entries > 200 || expanded > MAX_EXPANDED_WORKBOOK_BYTES) {
            fail(
              new PayloadTooLargeException(
                'Workbook exceeds the expanded upload limit',
              ),
            );
            return;
          }
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              fail(streamError ?? new Error('Invalid workbook entry'));
              return;
            }
            stream.once('error', fail);
            stream.once('end', () => zip.readEntry());
            stream.resume();
          });
        });
        zip.readEntry();
      },
    );
  });
}

@Injectable()
export class HouseholdImportService {
  async read(filename: string, buffer: Buffer) {
    const extension = filename.toLowerCase().split('.').at(-1);
    if (extension !== 'csv' && extension !== 'xlsx') {
      throw new BadRequestException('Upload a CSV or XLSX file');
    }

    let records: string[][];
    try {
      records =
        extension === 'csv'
          ? (parse(buffer, {
              bom: true,
              skip_empty_lines: true,
              relax_column_count: true,
              max_record_size: 8192,
              to: MAX_ROWS + 2,
            }) as string[][])
          : await this.readWorkbook(buffer);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) throw error;
      throw new BadRequestException('Invalid household import file');
    }

    const [header, ...data] = records;
    if (
      !header ||
      header.length < 2 ||
      header.some((field) => !columns.includes(field.trim().toLowerCase()))
    ) {
      throw new BadRequestException(
        'Expected name and address columns, with optional email and phone',
      );
    }
    const fields = header.map((field) => field.trim().toLowerCase());
    if (
      new Set(fields).size !== fields.length ||
      !fields.includes('name') ||
      !fields.includes('address')
    ) {
      throw new BadRequestException(
        'Expected unique columns including name and address',
      );
    }
    if (data.length > MAX_ROWS)
      throw new PayloadTooLargeException(
        'Import supports up to 1000 households',
      );

    const rows: CreateHouseholdDto[] = [];
    const errors: RowError[] = [];
    const seen = new Set<string>();
    for (const [index, record] of data.entries()) {
      const row = index + 2;
      if (record.length > fields.length) {
        errors.push({ row, field: 'row', message: 'Too many columns' });
        continue;
      }
      const values = Object.fromEntries(
        fields.map((field, i) => [field, record[i]?.trim() ?? '']),
      );
      const household = plainToInstance(CreateHouseholdDto, {
        name: values.name,
        address: values.address,
        contact: {
          email: values.email || undefined,
          phone: values.phone || undefined,
        },
      });
      const key = JSON.stringify([
        household.name.toLowerCase(),
        household.address.toLowerCase(),
        household.contact.email?.toLowerCase(),
        household.contact.phone,
      ]);
      if (seen.has(key)) {
        errors.push({
          row,
          field: 'row',
          message: 'Duplicate household in this file',
        });
        continue;
      }
      seen.add(key);
      const validation = validateSync(household);
      errors.push(...flatten(validation, row));
      rows.push(household);
    }

    return { rows, errors };
  }

  private async readWorkbook(buffer: Buffer): Promise<string[][]> {
    await validateArchive(buffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    if (sheet.rowCount > MAX_ROWS + 1)
      throw new PayloadTooLargeException(
        'Import supports up to 1000 households',
      );

    const records: string[][] = [];
    for (let index = 1; index <= sheet.rowCount; index += 1) {
      const row = sheet.getRow(index);
      if (row.cellCount > columns.length)
        throw new BadRequestException('Spreadsheet has too many columns');
      const values: string[] = [];
      for (let column = 1; column <= row.cellCount; column += 1) {
        const cell = row.getCell(column);
        if (cell.type === ExcelJS.ValueType.Formula)
          throw new BadRequestException('Spreadsheet formulas are unsupported');
        values.push(cell.text);
      }
      records.push(values);
    }
    return records;
  }
}

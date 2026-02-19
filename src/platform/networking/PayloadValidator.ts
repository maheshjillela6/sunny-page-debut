/**
 * PayloadValidator - Validates API request/response payloads
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class PayloadValidator {
  // Validate game launch response
  public validateGameLaunchResponse(response: any): ValidationResult {
    const errors: string[] = [];

    if (!response.data) {
      errors.push('Missing data field');
      return { valid: false, errors };
    }

    const data = response.data;

    if (!data.gameId) errors.push('Missing gameId');
    if (!data.gamename) errors.push('Missing gamename');
    if (!data.balance?.amount && data.balance?.amount !== 0) errors.push('Missing balance.amount');
    if (!data.reels) errors.push('Missing reels configuration');
    if (!data.state) errors.push('Missing state');

    return { valid: errors.length === 0, errors };
  }

  // Validate spin response
  public validateSpinResponse(response: any): ValidationResult {
    const errors: string[] = [];

    if (!response.data) {
      errors.push('Missing data field');
      return { valid: false, errors };
    }

    const data = response.data;

    if (!data.round?.roundId) errors.push('Missing round.roundId');
    if (!data.round?.matrixString) errors.push('Missing round.matrixString');
    if (!data.balance?.amount && data.balance?.amount !== 0) errors.push('Missing balance.amount');
    if (!data.stake?.amount && data.stake?.amount !== 0) errors.push('Missing stake.amount');
    if (!data.win && data.win?.amount !== 0) errors.push('Missing win');

    // Validate matrix string format
    if (data.round?.matrixString) {
      const rows = data.round.matrixString.split(';');
      if (rows.length === 0) {
        errors.push('Invalid matrixString format');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Validate feature action response
  public validateFeatureActionResponse(response: any): ValidationResult {
    const errors: string[] = [];

    if (!response.data) {
      errors.push('Missing data field');
      return { valid: false, errors };
    }

    const data = response.data;

    if (!data.balance?.amount && data.balance?.amount !== 0) errors.push('Missing balance.amount');
    if (!data.series) errors.push('Missing series data');
    if (!data.nextAction) errors.push('Missing nextAction');

    return { valid: errors.length === 0, errors };
  }

  // Validate buy bonus response
  public validateBuyBonusResponse(response: any): ValidationResult {
    const errors: string[] = [];

    if (!response.data) {
      errors.push('Missing data field');
      return { valid: false, errors };
    }

    const data = response.data;

    if (!data.purchase?.purchaseId) errors.push('Missing purchase.purchaseId');
    if (!data.balance?.amount && data.balance?.amount !== 0) errors.push('Missing balance.amount');
    if (!data.series) errors.push('Missing series data');

    return { valid: errors.length === 0, errors };
  }

  // Generic field validator
  public validateRequired(obj: any, fields: string[]): ValidationResult {
    const errors: string[] = [];

    for (const field of fields) {
      const parts = field.split('.');
      let value = obj;

      for (const part of parts) {
        if (value === undefined || value === null) {
          errors.push(`Missing required field: ${field}`);
          break;
        }
        value = value[part];
      }

      if (value === undefined || value === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Validate money value format
  public validateMoneyValue(value: any, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (!value) {
      errors.push(`Missing ${fieldName}`);
      return { valid: false, errors };
    }

    if (typeof value.amount !== 'number') {
      errors.push(`${fieldName}.amount must be a number`);
    }

    if (typeof value.currency !== 'string') {
      errors.push(`${fieldName}.currency must be a string`);
    }

    return { valid: errors.length === 0, errors };
  }
}

export default PayloadValidator;

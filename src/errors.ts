export class IdlDeriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnknownTypeError extends IdlDeriveError {
  constructor(
    public readonly fieldName: string,
    public readonly typeName: string,
  ) {
    super(
      `
            Unknown IDL type "${typeName}" for field "${fieldName}".` +
        `Supported: uint8, uint32, uint64, secp256k1_sig, secp256k1_pubkey, schnorr_sig, bytes`,
    );
  }
}

export class FieldTooShortError extends IdlDeriveError {
  constructor(
    public readonly fieldName: string,
    public readonly expected: number,
    public readonly got: number,
  ) {
    super(
      `Buffer too short for field "${fieldName}": expected ${expected} bytes, got ${got}`,
    );
  }
}

export class TrailingBytesError extends IdlDeriveError {
  constructor(
    public readonly consumed: number,
    public readonly total: number,
  ) {
    super(
      `Trailing bytes after decoding: consumed ${consumed}, total ${total}`,
    );
  }
}

export class MissingLockFieldError extends IdlDeriveError {
  constructor() {
    super("WitnessArgs.lock field is absent");
  }
}

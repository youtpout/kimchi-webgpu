// curve.wgsl

// @import types.wgsl

// Vesta curve equation: y² = x³ + 5

// Vesta prime modulus (field size)
const PALLAS_P: array<u32, 8> = array<u32, 8>(
    0x00000001u, 0x8C46EB21u, 0x0994A8DDu, 0x224698FCu,
    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u
);

// Vesta R² mod p, used to convert numbers into Montgomery form for fast arithmetic
const PALLAS_R2: array<u32, 8> = array<u32, 8>(
    0x0000000Fu, 0xFC9678FFu, 0x891A16E3u, 0x67BB433Du,
    0x04CCF590u, 0x7FAE2310u, 0x7CCFDAA9u, 0x096D41AFu
);

// Pallas -p⁻¹ mod 2^32, required for Montgomery reduction in field operations  
const PALLAS_MONT_INV32: u32 = 0xffffffffu;

// Vesta curve coefficient 'a' in y² = x³ + a*x + b (here a = 0 for Vesta)
const PALLAS_A: array<u32, 8> = array<u32, 8>(
    0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u
);

// Vesta curve coefficient 'b' in y² = x³ + a*x + b (here b = 5 for Vesta)
const PALLAS_B: array<u32, 8> = array<u32, 8>(
    0u, 0u, 0u, 0u, 0u, 0u, 0u, 5u
);

// Vesta p - 2, used for modular inverse computation
const PALLAS_P_MINUS_2: array<u32, 8> = array<u32, 8>(
    0xFFFFFFFFu, 0x8C46EB20u, 0x0994A8DDu, 0x224698FCu,
    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u
);

// Vesta r_mod_p : Montgomery representation of 1 (R mod p), used to initialize Z in projective points
const PALLAS_R_MOD_P: array<u32, 8> = array<u32, 8>(
    0xFFFFFFFDu, 0x5B2B3E9Cu, 0xE3420567u, 0x992C350Bu,
    0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0x3FFFFFFFu
);

// Complete Vesta curve parameters as a Curve256 instance
const PALLAS_CURVE: Curve256 = Curve256(PALLAS_P, PALLAS_R2, PALLAS_MONT_INV32, PALLAS_A, PALLAS_B, PALLAS_P_MINUS_2, PALLAS_R_MOD_P);

// dist/src/proof/embeddedO1jsCompileCache.js
var manifestPromiseCache = /* @__PURE__ */ new Map();
function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}
async function fetchManifest(baseUrl) {
  const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
  if (!manifestResponse.ok) {
    if (manifestResponse.status === 404)
      return void 0;
    throw new Error(`Failed to fetch embedded compile cache manifest: ${manifestResponse.status} ${manifestResponse.statusText}`);
  }
  return await manifestResponse.json();
}
async function loadManifestEntries(baseUrl, manifest) {
  const entries = await Promise.all(manifest.entries.map(async (entry) => {
    const response = await fetch(`${baseUrl}/${entry.file}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch embedded compile cache entry ${entry.persistentId}: ${response.status} ${response.statusText}`);
    }
    const bytes = entry.dataType === "bytes" ? new Uint8Array(await response.arrayBuffer()) : new TextEncoder().encode(await response.text());
    return [entry.persistentId, bytes, entry];
  }));
  const payloads = /* @__PURE__ */ new Map();
  for (const [persistentId, bytes, entry] of entries) {
    payloads.set(persistentId, { bytes, entry });
  }
  return payloads;
}
function createReadonlyCache(payloads) {
  return {
    canWrite: false,
    read(header) {
      const payload = payloads.get(header.persistentId);
      if (payload === void 0)
        return void 0;
      if (payload.entry.uniqueId !== header.uniqueId)
        return void 0;
      if (payload.entry.dataType !== header.dataType)
        return void 0;
      return payload.bytes;
    },
    write() {
      throw new Error("Embedded compile cache is read-only");
    }
  };
}
async function preloadEmbeddedO1jsCompileCache(cacheName) {
  if (typeof window === "undefined")
    return void 0;
  const baseUrl = normalizeBaseUrl(`/o1js-cache/${cacheName}`);
  const cachedPromise = manifestPromiseCache.get(baseUrl);
  if (cachedPromise !== void 0)
    return cachedPromise;
  const cachePromise = (async () => {
    const manifest = await fetchManifest(baseUrl);
    if (manifest === void 0)
      return void 0;
    const payloads = await loadManifestEntries(baseUrl, manifest);
    return createReadonlyCache(payloads);
  })();
  manifestPromiseCache.set(baseUrl, cachePromise);
  return cachePromise;
}

// dist/src/gpu/256bit/types.wgsl
var types_default = "// types.wgsl\n\n// Represents a 256-bit integer as 8 32-bit limbs (little-endian)\n// limbs[0] = least significant 32 bits\nstruct Limbs256 {\n    limbs: array<u32, 8>       // limbs[0] = least significant 32 bits\n};\n\n// Represents a zero limbed 256-bit integer as 8 32-bit limbs (little-endian) all zeros\nconst IDENTITY_LIMBS_256: Limbs256 = Limbs256(\n    array<u32, 8>(0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u)\n);\n\n// Represents a point in affine coordinates over a 256-bit field\n// x, y coordinates are in Montgomery form\nstruct Point256 {\n    x: Limbs256,                // x-coordinate of the point\n    y: Limbs256                 // y-coordinate of the point\n};\n\n// Represents a point in projective coordinates over a 256-bit field\n// x, y, z are in Montgomery form\n// Point at infinity if Z = 0\nstruct ProjectivePoint256 {\n    x: Limbs256,                // Projective x coordinate\n    y: Limbs256,                // Projective y coordinate\n    z: Limbs256                 // Projective z coordinate (point at infinity if z = 0)\n};\n\n// Represents the parameters of a 256-bit elliptic curve\n// p      : prime modulus of the field\n// r2     : R\xB2 mod p, for Montgomery conversion\n// mont_inv32 : -p\u207B\xB9 mod 2^32 for Montgomery reduction\n// a, b   : curve coefficients\n// p_minus_2  : p - 2, used for modular inverse via Fermat's little theorem\n// r_mod_p : Montgomery representation of 1 (R mod p), used to initialize Z in projective points\nstruct Curve256 {\n    p: array<u32, 8>,          // Prime modulus of the curve (field size)\n    r2: array<u32, 8>,         // R\xB2 mod p, used for converting numbers into Montgomery form\n    mont_inv32: u32,           // -p\u207B\xB9 mod 2^32, used in Montgomery reduction\n    a: array<u32, 8>,          // Curve coefficient 'a' in the equation y\xB2 = x\xB3 + a*x + b\n    b: array<u32, 8>,          // Curve coefficient 'b' in the equation y\xB2 = x\xB3 + a*x + b\n    p_minus_2: array<u32, 8>,   // p - 2, for computing modular inverse: a^(-1) = a^(p-2) mod p\n    r_mod_p: array<u32, 8>     // Montgomery representation of 1 (R mod p), for initializing Z in projective points\n};";

// dist/src/gpu/256bit/arithmetic.wgsl
var arithmetic_default = "// arithmetic.wgsl\n\n// @import types.wgsl\n\n// Compare two 256-bit integers\n// Inputs: a, b : 256-bit integers\n// Output: true if a >= b\n// Path: compare most significant limb first, stop at first difference\nfn gte_256(a: array<u32, 8>, b: array<u32, 8>) -> bool {\n    var i: i32 = 7;\n    loop {\n        if (i < 0) { break; }\n        if (a[i] > b[i]) { return true; }\n        if (a[i] < b[i]) { return false; }\n        i = i - 1;\n    }\n    return true;\n}\n\n// Subtract two 256-bit integers without underflow\n// Inputs: a, b : 256-bit integers\n// Output: result = a - b (wraparound prevented)\n// Formula: result[i] = a[i] - b[i] - borrow_from_previous\n// borrow = 1 if previous subtraction underflowed, 0 otherwise\nfn sub_no_borrow_256(a: array<u32, 8>, b: array<u32, 8>) -> array<u32, 8> {\n    var result: array<u32, 8>;\n    var borrow: u32 = 0u;\n\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        let ai = a[i];\n        let bi = b[i];\n        // Two-step subtraction avoids the bi+borrow u32 overflow when bi=0xFFFFFFFF\n        // and borrow=1 (which wraps to 0 and silently drops the carry).\n        let sub1 = ai - bi;\n        let borrow1 = u32(ai < bi);\n        let sub2 = sub1 - borrow;\n        let borrow2 = u32(sub1 < borrow);\n        result[i] = sub2;\n        borrow = borrow1 + borrow2; // always 0 or 1 (never 2)\n    }\n\n    return result;\n}\n\n// Modular addition: (a + b) mod p\n// Inputs: a, b : 256-bit integers; p : modulus\n// Output: (a + b) mod p\n// Path: limb-wise addition with carry; subtract p if result >= p\nfn add_mod_256(a: array<u32, 8>, b: array<u32, 8>, p: array<u32, 8>) -> array<u32, 8> {\n    var result: array<u32, 8>;\n    var carry: u32 = 0u;\n    \n    for (var i = 0u; i < 8u; i = i + 1u) {\n        let sum_low = a[i] + b[i];\n        let carry_from_low = u32(sum_low < a[i]);\n        \n        let sum_with_carry = sum_low + carry;\n        let carry_from_carry = u32(sum_with_carry < sum_low);\n        \n        result[i] = sum_with_carry;\n        carry = carry_from_low + carry_from_carry;\n    }\n    \n    if (carry != 0u || gte_256(result, p)) {\n        result = sub_no_borrow_256(result, p);\n    }\n    \n    return result;\n}\n\n// Modular subtraction: (a - b) mod p\n// Inputs: a, b : 256-bit integers; p : modulus\n// Output: (a - b) mod p\n// Path: if a >= b, result = a - b; else result = p - (b - a)\nfn sub_mod_256(a: array<u32, 8>, b: array<u32, 8>, p: array<u32, 8>) -> array<u32, 8> {\n    if (gte_256(a, b)) {\n        return sub_no_borrow_256(a, b);\n    } else {\n        let diff = sub_no_borrow_256(b, a);\n        return sub_no_borrow_256(p, diff);\n    }\n}\n\n// Multiply two 32-bit integers and accumulate with carry\n// Inputs: a, b : u32 integers; acc : current limb value; carry : propagated carry\n// Output: updated limb = (a*b + acc + *carry) mod 2^32\n// Path: split a, b into high/low 16-bit halves, compute cross-products, propagate carry\nfn mul_add_carry(a: u32, b: u32, acc: u32, carry: ptr<function, u32>) -> u32 {\n    let a_lo = a & 0xFFFFu;\n    let a_hi = a >> 16u;\n    let b_lo = b & 0xFFFFu;\n    let b_hi = b >> 16u;\n\n    let p0 = a_lo * b_lo;\n    let p1 = a_lo * b_hi;\n    let p2 = a_hi * b_lo;\n    let p3 = a_hi * b_hi;\n\n    // Combine middle terms\n    let mid = p1 + p2;\n    let mid_carry = u32(mid < p1);\n\n    // Add lower 16 bits of mid to low part\n    let low = p0 + (mid << 16u);\n    let low_carry = u32(low < p0);\n\n    // Compute high 32-bit including previous carries\n    // mid_carry needs to be at bit position 32 (upper 16 bits of the high word)\n    let high = p3 + (mid >> 16u) + (mid_carry << 16u) + low_carry;\n\n    // Add acc\n    let temp = low + acc;\n    let temp_carry = u32(temp < low);\n\n    // Add existing carry\n    let final_res = temp + *carry;\n    let final_carry = u32(final_res < temp);\n\n    // Update carry\n    *carry = high + temp_carry + final_carry;\n\n    return final_res;\n}\n\n// Montgomery reduction: REDC(T) = T * R^-1 mod p\n// Inputs:\n//   t          : 512-bit integer (16 u32 limbs)\n//   mont_inv32 : -p\u207B\xB9 mod 2^32\n//   p          : prime modulus\n// Output: 256-bit integer = T * R^-1 mod p\n// Path:\n//   For each limb i of t:\n//     m = t[i] * mont_inv32\n//     temp += m * p -> t[i] becomes 0\n//   Upper 256 bits = result\n//   If result >= p, subtract p\nfn montgomery_reduce_256(t: array<u32, 16>, mont_inv32: u32, p: array<u32, 8>) -> array<u32, 8> {\n    var temp = t;\n    \n    // Montgomery reduction loop\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        // m = temp[i] * mont_inv32 mod 2^32\n        let m = temp[i] * mont_inv32;\n        \n        // temp += m * p (this makes temp[i] = 0)\n        var carry: u32 = 0u;\n        for (var j = 0u; j < 8u; j = j + 1u) {\n            temp[i + j] = mul_add_carry(m, p[j], temp[i + j], &carry);\n        }\n        \n        // Propagate carry to high limbs\n        var k = i + 8u;\n        loop {\n            if (k >= 16u || carry == 0u) { break; }\n            let sum = temp[k] + carry;\n            carry = u32(sum < temp[k]);\n            temp[k] = sum;\n            k = k + 1u;\n        }\n    }\n    \n    // Extract upper 256 bits (temp >> 256)\n    var result: array<u32, 8>;\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        result[i] = temp[i + 8u];\n    }\n    \n    // Final conditional subtraction\n    if (gte_256(result, p)) {\n        result = sub_no_borrow_256(result, p);\n    }\n    \n    return result;\n}\n\n// Montgomery multiplication: (a * b * R^-1) mod p\n// Inputs: a, b : 256-bit integers; mont_inv32, p : parameters\n// Output: 256-bit integer = a * b * R^-1 mod p\n// Path: compute 512-bit product, then Montgomery reduce\nfn mont_mul_256(a: array<u32, 8>, b: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> array<u32, 8> {\n    var product: array<u32, 16>;\n    for (var i = 0u; i < 16u; i = i + 1u) {\n        product[i] = 0u;\n    }\n    \n    // Compute a * b\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        var carry: u32 = 0u;\n        for (var j = 0u; j < 8u; j = j + 1u) {\n            product[i + j] = mul_add_carry(a[i], b[j], product[i + j], &carry);\n        }\n        product[i + 8u] = carry;\n    }\n    \n    return montgomery_reduce_256(product, mont_inv32, p);\n}\n\n// Convert a 256-bit integer to Montgomery form\n// Inputs: a, r2, mont_inv32, p\n// Output: a * R mod p\nfn to_montgomery_256(a: array<u32, 8>, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> array<u32, 8> {\n    return mont_mul_256(a, r2, mont_inv32, p);\n}\n\n// Convert a 256-bit integer from Montgomery form\n// Inputs: a : 256-bit integer in Montgomery form; mont_inv32, p : Montgomery parameters\n// Output: a * R^-1 mod p\n// Path: multiply by 1 using Montgomery multiplication\nfn from_montgomery_256(a: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> array<u32, 8> {\n    let one: array<u32, 8> = array<u32, 8>(1u, 0u, 0u, 0u, 0u, 0u, 0u, 0u);\n    return mont_mul_256(a, one, mont_inv32, p);\n}\n\n// Modular inverse in Montgomery form\n// Inputs: a : 256-bit integer in Montgomery form\n//         r2, mont_inv32, p : parameters\n//         p_minus_2 : p-2 for Fermat's inverse\n// Output: a^-1 mod p in Montgomery form\n// Path: exponentiation by squaring: result = a^(p-2)\nfn mod_inverse_mont_256(a: array<u32, 8>, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>, p_minus_2: array<u32, 8>) -> array<u32, 8> {\n    var result: array<u32, 8>;\n    result[0] = 1u;\n    for (var i = 1u; i < 8u; i = i + 1u) {\n        result[i] = 0u;\n    }\n    result = to_montgomery_256(result, r2, mont_inv32, p); // 1 in Montgomery form\n    \n    var base = a; // Already in Montgomery form\n    \n    for (var limb_idx = 0u; limb_idx < 8u; limb_idx = limb_idx + 1u) {\n        var bits = p_minus_2[limb_idx];\n        \n        for (var bit = 0u; bit < 32u; bit = bit + 1u) {\n            if ((bits & 1u) == 1u) {\n                result = mont_mul_256(result, base, mont_inv32, p);\n            }\n            base = mont_mul_256(base, base, mont_inv32, p);\n            bits = bits >> 1u;\n        }\n    }\n    \n    return result;\n}\n\n// Check if projective point P is infinity (z == 0)\nfn is_infinity_proj_256(P: ProjectivePoint256) -> bool {\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        if (P.z.limbs[i] != 0u) {\n            return false;\n        }\n    }\n    return true;\n}\n\n// Convert affine point (x, y) to projective coordinates (x:y:z)\n// Inputs: x, y : Limbs256, r2, mont_inv32, p\n// Output: ProjectivePoint256 P in Montgomery form, z = 1\nfn to_projective_256(x: Limbs256, y: Limbs256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> ProjectivePoint256 {\n    var P: ProjectivePoint256;\n    // Convert to Montgomery form\n    P.x.limbs = to_montgomery_256(x.limbs, r2, mont_inv32, p);\n    P.y.limbs = to_montgomery_256(y.limbs, r2, mont_inv32, p);\n    P.z.limbs[0] = 1u;\n    for (var i = 1u; i < 8u; i = i + 1u) {\n        P.z.limbs[i] = 0u;\n    }\n    P.z.limbs = to_montgomery_256(P.z.limbs, r2, mont_inv32, p);\n    return P;\n}\n\n// Convert Jacobian projective point to affine coordinates.\n// The addition and doubling formulas use Jacobian coordinates where\n// affine = (X/Z\xB2, Y/Z\xB3).\n// Inputs: P : ProjectivePoint256 in Jacobian form, r2, mont_inv32, p, p_minus_2\n// Output: Q : Point256 (x, y) in affine coordinates (standard form)\nfn to_affine_256(P: ProjectivePoint256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>, p_minus_2: array<u32, 8>) -> Point256 {\n    if (is_infinity_proj_256(P)) { // Note is_infinity_proj_256 returns are not constant time and so would be vulnerable to timing attacks FIXME\n        var inf: Point256;\n        for (var i = 0u; i < 8u; i = i + 1u) {\n            inf.x.limbs[i] = 0u;\n            inf.y.limbs[i] = 0u;\n        }\n        return inf;\n    }\n\n    // Jacobian: affine x = X / Z\xB2, affine y = Y / Z\xB3\n    let z_inv  = mod_inverse_mont_256(P.z.limbs, r2, mont_inv32, p, p_minus_2);\n    let z_inv2 = mont_mul_256(z_inv, z_inv, mont_inv32, p);\n    let z_inv3 = mont_mul_256(z_inv2, z_inv, mont_inv32, p);\n\n    var Q: Point256;\n    Q.x.limbs = mont_mul_256(P.x.limbs, z_inv2, mont_inv32, p);\n    Q.y.limbs = mont_mul_256(P.y.limbs, z_inv3, mont_inv32, p);\n\n    // Convert back from Montgomery form\n    Q.x.limbs = from_montgomery_256(Q.x.limbs, mont_inv32, p);\n    Q.y.limbs = from_montgomery_256(Q.y.limbs, mont_inv32, p);\n\n    return Q;\n}\n\n// Point doubling in projective coordinates\n// Inputs: P : ProjectivePoint256, r2, mont_inv32, p\n// Output: Q = 2*P in projective coordinates\n// Path:\n//   xx = x^2, yy = y^2, yyyy = yy^2, zz = z^2\n//   s  = 2*((x+yy)^2 - xx - yyyy)\n//   m  = 3*xx\n//   x3 = m^2 - 2*s\n//   y3 = m*(s - x3) - 8*yyyy\n//   z3 = (y+z)^2 - yy - zz\nfn point_double_proj_256(P: ProjectivePoint256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> ProjectivePoint256 {\n    if (is_infinity_proj_256(P)) { return P; } // Note is_infinity_proj_256 returns are not constant time and so would be vulnerable to timing attacks FIXME\n    \n    let xx = mont_mul_256(P.x.limbs, P.x.limbs, mont_inv32, p);\n    let yy = mont_mul_256(P.y.limbs, P.y.limbs, mont_inv32, p);\n    let yyyy = mont_mul_256(yy, yy, mont_inv32, p);\n    let zz = mont_mul_256(P.z.limbs, P.z.limbs, mont_inv32, p);\n    \n    var s = add_mod_256(P.x.limbs, yy, p);\n    s = mont_mul_256(s, s, mont_inv32, p);\n    s = sub_mod_256(s, xx, p);\n    s = sub_mod_256(s, yyyy, p);\n    s = add_mod_256(s, s, p);\n    \n    var m = add_mod_256(xx, xx, p);\n    m = add_mod_256(m, xx, p);\n    \n    var t = mont_mul_256(m, m, mont_inv32, p);\n    t = sub_mod_256(t, add_mod_256(s, s, p), p);\n    \n    var Q: ProjectivePoint256;\n    Q.x.limbs = t;\n    \n    var y3 = sub_mod_256(s, t, p);\n    y3 = mont_mul_256(m, y3, mont_inv32, p);\n    var yyyy8 = add_mod_256(yyyy, yyyy, p);\n    yyyy8 = add_mod_256(yyyy8, yyyy8, p);\n    yyyy8 = add_mod_256(yyyy8, yyyy8, p);\n    Q.y.limbs = sub_mod_256(y3, yyyy8, p);\n    \n    var z3 = add_mod_256(P.y.limbs, P.z.limbs, p);\n    z3 = mont_mul_256(z3, z3, mont_inv32, p);\n    z3 = sub_mod_256(z3, yy, p);\n    z3 = sub_mod_256(z3, zz, p);\n    Q.z.limbs = z3;\n    \n    return Q;\n}\n\n// Point addition in projective coordinates\n// Inputs: P, Q : ProjectivePoint256, r2, mont_inv32, p\n// Output: R = P + Q in projective coordinates\n// Path:\n//   z1z1 = z1^2, z2z2 = z2^2\n//   u1 = x1*z2z2, u2 = x2*z1z1\n//   s1 = y1*z2*z2z2, s2 = y2*z1*z1z1\n//   If u1 == u2 and s1 == s2, return 2*P\n//   h = u2 - u1, i = (2*h)^2, j = h*i\n//   r = 2*(s2 - s1), v = u1*i\n//   x3 = r^2 - j - 2*v\n//   y3 = r*(v - x3) - 2*s1*j\n//   z3 = ((z1+z2)^2 - z1z1 - z2z2)*h\nfn point_add_proj_256(P: ProjectivePoint256, Q: ProjectivePoint256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>) -> ProjectivePoint256 {\n    // Note is_infinity_proj_256 returns are not constant time and so would be vulnerable to timing attacks FIXME\n    if (is_infinity_proj_256(P)) { return Q; }\n    if (is_infinity_proj_256(Q)) { return P; }\n    \n    let z1z1 = mont_mul_256(P.z.limbs, P.z.limbs, mont_inv32, p);\n    let z2z2 = mont_mul_256(Q.z.limbs, Q.z.limbs, mont_inv32, p);\n    \n    let u1 = mont_mul_256(P.x.limbs, z2z2, mont_inv32, p);\n    let u2 = mont_mul_256(Q.x.limbs, z1z1, mont_inv32, p);\n    \n    let s1 = mont_mul_256(P.y.limbs, mont_mul_256(Q.z.limbs, z2z2, mont_inv32, p), mont_inv32, p);\n    let s2 = mont_mul_256(Q.y.limbs, mont_mul_256(P.z.limbs, z1z1, mont_inv32, p), mont_inv32, p);\n    \n    var same_x = true;\n    var same_y = true;\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        if (u1[i] != u2[i]) { same_x = false; }\n        if (s1[i] != s2[i]) { same_y = false; }\n    }\n    if (same_x && same_y) {\n        return point_double_proj_256(P, r2, mont_inv32, p);\n    }\n    \n    let h = sub_mod_256(u2, u1, p);\n    var i = add_mod_256(h, h, p);\n    i = mont_mul_256(i, i, mont_inv32, p);\n    let j = mont_mul_256(h, i, mont_inv32, p);\n    \n    var r = sub_mod_256(s2, s1, p);\n    r = add_mod_256(r, r, p);\n    \n    let v = mont_mul_256(u1, i, mont_inv32, p);\n    \n    var x3 = mont_mul_256(r, r, mont_inv32, p);\n    x3 = sub_mod_256(x3, j, p);\n    x3 = sub_mod_256(x3, add_mod_256(v, v, p), p);\n    \n    var y3 = sub_mod_256(v, x3, p);\n    y3 = mont_mul_256(r, y3, mont_inv32, p);\n    let s1j = mont_mul_256(s1, j, mont_inv32, p);\n    let s1j2 = add_mod_256(s1j, s1j, p);\n    y3 = sub_mod_256(y3, s1j2, p);\n    \n    var z3 = add_mod_256(P.z.limbs, Q.z.limbs, p);\n    z3 = mont_mul_256(z3, z3, mont_inv32, p);\n    z3 = sub_mod_256(z3, z1z1, p);\n    z3 = sub_mod_256(z3, z2z2, p);\n    z3 = mont_mul_256(z3, h, mont_inv32, p);\n    \n    var R: ProjectivePoint256;\n    R.x.limbs = x3;\n    R.y.limbs = y3;\n    R.z.limbs = z3;\n    return R;\n}\n\n// Scalar multiplication: k*P\n// Inputs: k : scalar (Limbs256), P : point (x, y coordinates), r2, mont_inv32, p, p_minus_2\n// Output: Q = k*P in affine coordinates\n// Path: double-and-add algorithm, process scalar bits from LSB to MSB\nfn scalar_mul_256(k: Limbs256, P_x: Limbs256, P_y: Limbs256, r2: array<u32, 8>, mont_inv32: u32, p: array<u32, 8>, p_minus_2: array<u32, 8>) -> Point256 {\n    let P = to_projective_256(P_x, P_y, r2, mont_inv32, p);\n    \n    var Q: ProjectivePoint256;\n    for (var i = 0u; i < 8u; i = i + 1u) {\n        Q.x.limbs[i] = 0u;\n        Q.y.limbs[i] = 0u;\n        Q.z.limbs[i] = 0u;\n    }\n    \n    var base = P;\n    \n    for (var limb_idx = 0u; limb_idx < 8u; limb_idx = limb_idx + 1u) {\n        var bits = k.limbs[limb_idx];\n        \n        for (var bit = 0u; bit < 32u; bit = bit + 1u) {\n            if ((bits & 1u) == 1u) {\n                Q = point_add_proj_256(Q, base, r2, mont_inv32, p);\n            }\n            base = point_double_proj_256(base, r2, mont_inv32, p);\n            bits = bits >> 1u;\n        }\n    }\n    \n    return to_affine_256(Q, r2, mont_inv32, p, p_minus_2);\n}\n\n// Scalar multiplication for arbitrary curve: k*P\n// Inputs: k : scalar (Limbs256), P : point (x, y coordinates), curve : Curve256 parameters\n// Output: Q = k*P in affine coordinates\n// Path: uses curve parameters with generic scalar_mul_256\nfn curve_scalar_mul(k: Limbs256, P_x: Limbs256, P_y: Limbs256, curve: Curve256) -> Point256 {\n    return scalar_mul_256(\n        k, P_x, P_y,\n        curve.r2,\n        curve.mont_inv32,\n        curve.p,\n        curve.p_minus_2\n    );\n}";

// dist/src/gpu/256bit/pallas/curve.wgsl
var curve_default = "// curve.wgsl\n\n// @import types.wgsl\n\n// Pallas curve equation: y\xB2 = x\xB3 + 5\n\n// Pallas prime modulus (field size)  \nconst PALLAS_P: array<u32, 8> = array<u32, 8>(\n    0x00000001u, 0x992d30edu, 0x094cf91bu, 0x224698fcu,\n    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u\n);\n\n// Pallas R\xB2 mod p, used to convert numbers into Montgomery form for fast arithmetic  \nconst PALLAS_R2: array<u32, 8> = array<u32, 8>(\n    0x0000000Fu, 0x8C78ECB3u, 0x8B0DE0E7u, 0xD7D30DBDu,\n    0xC3C95D18u, 0x7797A99Bu, 0x7B9CB714u, 0x096D41AFu\n);\n\n// Pallas -p\u207B\xB9 mod 2^32, required for Montgomery reduction in field operations  \nconst PALLAS_MONT_INV32: u32 = 0xffffffffu;\n\n// Pallas curve coefficient 'a' in y\xB2 = x\xB3 + a*x + b (here a = 0 for Pallas)  \nconst PALLAS_A: array<u32, 8> = array<u32, 8>(\n    0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u\n);\n\n// Pallas curve coefficient 'b' in y\xB2 = x\xB3 + a*x + b (here b = 5 for Pallas)  \nconst PALLAS_B: array<u32, 8> = array<u32, 8>(\n    0u, 0u, 0u, 0u, 0u, 0u, 0u, 5u\n);\n\n// Pallas p - 2, used for modular inverse computation\nconst PALLAS_P_MINUS_2: array<u32, 8> = array<u32, 8>(\n    0xFFFFFFFFu, 0x992D30ECu, 0x094CF91Bu, 0x224698FCu,\n    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u\n);\n\n// Pallas r_mod_p : Montgomery representation of 1 (R mod p), used to initialize Z in projective points\nconst PALLAS_R_MOD_P: array<u32, 8> = array<u32, 8>(\n    0xFFFFFFFDu, 0x34786D38u, 0xE41914ADu, 0x992C350Bu,\n    0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0x3FFFFFFFu\n);\n\n// Complete Pallas curve parameters as a Curve256 instance  \nconst PALLAS_CURVE: Curve256 = Curve256(PALLAS_P, PALLAS_R2, PALLAS_MONT_INV32, PALLAS_A, PALLAS_B, PALLAS_P_MINUS_2, PALLAS_R_MOD_P);";

// dist/src/gpu/256bit/pallas/pippenger_msm.wgslc.js
var pippengerShaderPassAProjectiveConversion = `
${types_default}
${arithmetic_default}
${curve_default}

@group(0) @binding(0) var<storage, read> x: array<Limbs256>;
@group(0) @binding(1) var<storage, read> y: array<Limbs256>;
@group(0) @binding(2) var<storage, read_write> Px: array<Limbs256>;
@group(0) @binding(3) var<storage, read_write> Py: array<Limbs256>;
@group(0) @binding(4) var<storage, read_write> Pz: array<Limbs256>;
@group(0) @binding(5) var<uniform> n: u32; 

const WORKGROUP_SIZE: u32 = 64u;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let idx = gid.x;
    
    if (idx >= n) {
        return;
    }
    
    let P = to_projective_256(x[idx], y[idx], PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
    Px[idx] = P.x;
    Py[idx] = P.y;
    Pz[idx] = P.z;
}
`;
var pippengerShaderPassBi1BucketScalarWeightedPointContribution = `
${types_default}
${arithmetic_default}
${curve_default}

// Group 0: constant parameters (BUCKET_WIDTH_BITS never changes, window_idx changes per window)
@group(0) @binding(0) var<uniform> BUCKET_WIDTH_BITS: u32;
@group(0) @binding(1) var<uniform> window_idx: u32;

@group(1) @binding(0) var<uniform> bucket_idx: u32;

@group(2) @binding(0) var<storage, read> k: array<Limbs256>;
@group(2) @binding(1) var<storage, read> Px: array<Limbs256>;
@group(2) @binding(2) var<storage, read> Py: array<Limbs256>;
@group(2) @binding(3) var<storage, read> Pz: array<Limbs256>;

@group(3) @binding(0) var<storage, read_write> WGGx: array<Limbs256>;
@group(3) @binding(1) var<storage, read_write> WGGy: array<Limbs256>;
@group(3) @binding(2) var<storage, read_write> WGGz: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, 64>;
var<workgroup> WGLy: array<Limbs256, 64>;
var<workgroup> WGLz: array<Limbs256, 64>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let workgroup_idx = wgid.x;
    let local_idx = gid.x % WORKGROUP_SIZE;

    // Initialize workgroup memory with identity points for all threads
    WGLx[local_idx] = IDENTITY_LIMBS_256;
    WGLy[local_idx] = IDENTITY_LIMBS_256;
    WGLz[local_idx] = IDENTITY_LIMBS_256;

    workgroupBarrier();

    // Only process valid indices, but all threads participate in reduction
    if (idx < arrayLength(&k)) {
        // Extract the scalar bits for this window (window_idx) \u2014 NOT bucket_idx.
        // bucket_idx is the VALUE we are looking for within this window.
        let bit_offset = window_idx * BUCKET_WIDTH_BITS;
        let limb_index = bit_offset / 32u;
        let bit_in_limb = bit_offset % 32u;
        let mask = (1u << BUCKET_WIDTH_BITS) - 1u;

        var k_ij = 0u;
        if (bit_in_limb + BUCKET_WIDTH_BITS) <= 32u {
            k_ij = (k[idx].limbs[limb_index] >> bit_in_limb) & mask;
        } else {
            let bits_in_first_limb = 32u - bit_in_limb;
            let low_bits = k[idx].limbs[limb_index] >> bit_in_limb;
            let high_bits = k[idx].limbs[limb_index + 1u] << bits_in_first_limb;
            k_ij = (low_bits | high_bits) & mask;
        }

        if (k_ij == bucket_idx) {
            WGLx[local_idx] = Px[idx];
            WGLy[local_idx] = Py[idx];
            WGLz[local_idx] = Pz[idx];
        }
    }
    
    workgroupBarrier();

    // Tree reduce the workgroup memory bucket values by binary halving
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Set the global buffer based on the value of WGL_x,y,z[0] which contains the reduction
    if (local_idx == 0) {
        WGGx[workgroup_idx] = WGLx[0];
        WGGy[workgroup_idx] = WGLy[0];
        WGGz[workgroup_idx] = WGLz[0];
    }
}
`;
var pippengerShaderPassBi2TreeReduceBucket = `
${types_default}
${arithmetic_default}
${curve_default}

// Group 0: reduction parameters \u2014 packed into one uniform struct to minimise bind-group slots.
struct Bi2Uniforms {
    n: u32,                 // WGG elements to reduce in this dispatch
    window_idx: u32,        // which window we are processing
    number_of_buckets: u32, // NUMBER_OF_BUCKETS = 1 << BUCKET_WIDTH_BITS
}
@group(0) @binding(0) var<uniform> bi2: Bi2Uniforms;

@group(1) @binding(0) var<uniform> bucket_idx: u32;

@group(2) @binding(0) var<storage, read_write> WGGx: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> WGGy: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> WGGz: array<Limbs256>;

@group(3) @binding(0) var<storage, read_write> Bx: array<Limbs256>;
@group(3) @binding(1) var<storage, read_write> By: array<Limbs256>;
@group(3) @binding(2) var<storage, read_write> Bz: array<Limbs256>;

// 64 threads \xD7 3 coordinates \xD7 8 limbs \xD7 4 bytes = 6,144 bytes \u2014 well within the 16 KB limit.
const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;
    let n = bi2.n;

    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) {
        return;
    }

    // Load WGG into workgroup-local memory, padding out-of-bounds with identity.
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = WGGx[idx];
        WGLy[local_idx] = WGGy[idx];
        WGLz[local_idx] = WGGz[idx];
    }

    workgroupBarrier(); // ensure all loads are visible before reduction starts

    // Standard binary tree reduction: stride halves each step.
    // FIX: was using "half = stride >> 1" as the partner offset which skipped the upper
    // half of the workgroup entirely.  The correct partner is local_idx + stride.
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Thread 0 writes its workgroup's reduced result back to WGG.
    if (local_idx == 0u) {
        WGGx[workgroup_idx] = WGLx[0u];
        WGGy[workgroup_idx] = WGLy[0u];
        WGGz[workgroup_idx] = WGLz[0u];
    }

    // For the final pass (n fits in one workgroup), store the bucket result.
    // FIX: index into B using the 2-D (window, bucket) layout instead of a flat bucket_idx.
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        let b_idx = bi2.window_idx * bi2.number_of_buckets + bucket_idx;
        Bx[b_idx] = WGGx[0u];
        By[b_idx] = WGGy[0u];
        Bz[b_idx] = WGGz[0u];
    }
}
`;
var pippengerShaderPassCBucketAggregation = `
${types_default}
${arithmetic_default}
${curve_default}

// Group 0: per-window uniform parameters.
struct CUniforms {
    window_idx: u32,        // which window's buckets to aggregate
    number_of_buckets: u32, // NUMBER_OF_BUCKETS = 1 << BUCKET_WIDTH_BITS
}
@group(0) @binding(0) var<uniform> cu: CUniforms;

// B is now NUM_WINDOWS * NUMBER_OF_BUCKETS in size.
// B[window_idx * number_of_buckets + v] = sum of P_i where window w of scalar k_i equals v.
@group(1) @binding(0) var<storage, read_write> Bx: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> By: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> Bz: array<Limbs256>;

// F receives partial weighted sums (one entry per workgroup).
@group(2) @binding(0) var<storage, read_write> Fx: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> Fy: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> Fz: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;
var<workgroup> scaled: array<ProjectivePoint256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;       // bucket value v within this window (0 .. number_of_buckets-1)
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;
    let NB = cu.number_of_buckets;

    let workgroups_needed = (NB + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) {
        return;
    }

    // Step 1: Load B[window_idx * NB + idx] and apply Pippenger weight = idx (the bucket value).
    // Bucket 0 contributes nothing (scalar bits = 0 means the point is not in this bucket window).
    // FIX: weight = idx (the bucket value v), NOT NUM_BUCKETS - idx.
    if (idx == 0u || idx >= NB) {
        // Bucket 0 has weight 0; out-of-range threads hold identity.
        scaled[local_idx] = ProjectivePoint256(IDENTITY_LIMBS_256, IDENTITY_LIMBS_256, IDENTITY_LIMBS_256);
    } else {
        let b_idx = cu.window_idx * NB + idx;
        var weight = idx; // weight = bucket value v (1 .. NB-1)
        var accumulator = ProjectivePoint256(IDENTITY_LIMBS_256, IDENTITY_LIMBS_256, IDENTITY_LIMBS_256);
        var temp = ProjectivePoint256(Bx[b_idx], By[b_idx], Bz[b_idx]);

        // Binary scalar multiplication: weight * B[window_idx * NB + v]
        while (weight > 0u) {
            if ((weight & 1u) != 0u) {
                accumulator = point_add_proj_256(
                    accumulator, temp,
                    PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
                );
            }
            weight = weight >> 1u;
            if (weight > 0u) {
                temp = point_double_proj_256(
                    temp,
                    PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
                );
            }
        }
        scaled[local_idx] = accumulator;
    }

    workgroupBarrier();

    // Step 2: Tree reduction \u2014 sum all weighted bucket contributions within the workgroup.
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            scaled[local_idx] = point_add_proj_256(
                scaled[local_idx],
                scaled[local_idx + stride],
                PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
            );
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Step 3: Thread 0 writes the partial weighted sum to F.
    // Pass D will reduce F[0..ceil(NB/64)-1] into a single S_w for this window.
    if (local_idx == 0u) {
        Fx[workgroup_idx] = scaled[0u].x;
        Fy[workgroup_idx] = scaled[0u].y;
        Fz[workgroup_idx] = scaled[0u].z;
    }
}
`;
var pippengerShaderPassDTreeReduceFinalPoint = `
${types_default}
${arithmetic_default}
${curve_default}

// Uniform: number of points to reduce in this dispatch
@group(0) @binding(0) var<uniform> n: u32;
@group(0) @binding(1) var<uniform> batch_idx: u32;

// Storage: partially reduced points from Pass C
@group(1) @binding(0) var<storage, read_write> Fx: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> Fy: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> Fz: array<Limbs256>;

// Storage for batch final points (projective) - one per batch processed
@group(2) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;

    // Number of workgroups needed
    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) { 
        return; // We don't need these threads
    }

    // Load points into local workgroup memory
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = Fx[idx];
        WGLy[local_idx] = Fy[idx];
        WGLz[local_idx] = Fz[idx];
    }

    workgroupBarrier();

    // Tree reduction within workgroup
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Local thread 0 writes reduced result back to global Fx/y/z
    if (local_idx == 0u) {
        Fx[workgroup_idx] = WGLx[0];
        Fy[workgroup_idx] = WGLy[0];
        Fz[workgroup_idx] = WGLz[0];
    }

    // For the final pass (single workgroup), first global thread writes output
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        batch_final_points_x[batch_idx] = Fx[0];
        batch_final_points_y[batch_idx] = Fy[0];
        batch_final_points_z[batch_idx] = Fz[0];
    }
}
`;
var pippengerShaderPassEFinalAccumulation = `
${types_default}
${arithmetic_default}
${curve_default}

// Uniform: number of batch final points to reduce in this dispatch
@group(0) @binding(0) var<uniform> n: u32;

// Storage: batch final points from Pass D (projective)
@group(1) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

// Storage for final affine point
@group(2) @binding(0) var<storage, read_write> final_point_x: Limbs256;
@group(2) @binding(1) var<storage, read_write> final_point_y: Limbs256;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;

    // Number of workgroups needed
    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) { 
        return; // We don't need these threads
    }

    // Load batch final points into local workgroup memory
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = batch_final_points_x[idx];
        WGLy[local_idx] = batch_final_points_y[idx];
        WGLz[local_idx] = batch_final_points_z[idx];
    }

    workgroupBarrier();

    // Tree reduction within workgroup
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Local thread 0 writes reduced result back to global batch_final_points
    if (local_idx == 0u) {
        batch_final_points_x[workgroup_idx] = WGLx[0];
        batch_final_points_y[workgroup_idx] = WGLy[0];
        batch_final_points_z[workgroup_idx] = WGLz[0];
    }

    // For the final pass (single workgroup), first global thread converts to affine and writes final output
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        let finalProj = ProjectivePoint256(batch_final_points_x[0], batch_final_points_y[0], batch_final_points_z[0]);
        let finalAffine = to_affine_256(finalProj, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p, PALLAS_CURVE.p_minus_2);
        final_point_x = finalAffine.x;
        final_point_y = finalAffine.y;
    }
}
`;
var pippengerShaderPassHorner = `
${types_default}
${arithmetic_default}
${curve_default}

struct HornerUniforms {
    num_windows: u32,
    bucket_width_bits: u32,
    batch_idx: u32,
}
@group(0) @binding(0) var<uniform> hu: HornerUniforms;

// F_windows[w] = S_w, the weighted bucket sum for window w.
@group(1) @binding(0) var<storage, read_write> fw_x: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> fw_y: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> fw_z: array<Limbs256>;

// Output: batch_final_points[batch_idx] = Horner result (projective).
@group(2) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

@compute @workgroup_size(1)
fn main() {
    let NW = hu.num_windows;
    let W  = hu.bucket_width_bits;

    // Initialise with the highest window's sum.
    var result = ProjectivePoint256(
        fw_x[NW - 1u],
        fw_y[NW - 1u],
        fw_z[NW - 1u]
    );

    // Horner descent: result = 2^W * result + S_{w}  for w = NW-2 .. 0
    var w: i32 = i32(NW) - 2;
    while (w >= 0) {
        // Multiply result by 2^W via W repeated doublings.
        for (var d = 0u; d < W; d = d + 1u) {
            result = point_double_proj_256(result, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
        }
        // Add S_w.
        let sw = ProjectivePoint256(fw_x[u32(w)], fw_y[u32(w)], fw_z[u32(w)]);
        result = point_add_proj_256(result, sw, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
        w = w - 1;
    }

    batch_final_points_x[hu.batch_idx] = result.x;
    batch_final_points_y[hu.batch_idx] = result.y;
    batch_final_points_z[hu.batch_idx] = result.z;
}
`;

// dist/src/gpu/256bit/helpers.js
function writeBigint256ToLimbs(value, target, offset = 0) {
  let v = value;
  for (let i = 0; i < 8; i++) {
    target[offset + i] = Number(v & 0xffffffffn);
    v >>= 32n;
  }
}
function limbs256ToBigint(limbs) {
  let result = 0n;
  for (let i = 7; i >= 0; i--) {
    result = result << 32n | BigInt(limbs[i]);
  }
  return result;
}
var LIMBS_PER_ELEMENT_256 = 8;
var BYTES_PER_LIMB = 4;
var BYTES_PER_ELEMENT_256 = LIMBS_PER_ELEMENT_256 * BYTES_PER_LIMB;

// dist/src/gpu/256bit/pallas/pippenger_msm.js
var WORKGROUP_SIZE_A = 64;
var WORKGROUP_SIZE_BI1 = 64;
var WORKGROUP_SIZE_BI2 = 64;
var WORKGROUP_SIZE_C = 64;
var WORKGROUP_SIZE_D = 64;
var WORKGROUP_SIZE_E = 64;
var SCALAR_BITS = 256;
var runnerCache = /* @__PURE__ */ new WeakMap();
function normalizeBucketWidthBits(config) {
  const bucketWidthBits = config?.bucketWidthBits ?? 8;
  if (bucketWidthBits < 1 || bucketWidthBits > 22) {
    throw new Error("bucketWidthBits must be 1\u201322");
  }
  return bucketWidthBits;
}
function createPippengerMSMPallasRunner(device, config) {
  const bucketWidthBits = normalizeBucketWidthBits(config);
  let runnersByBucketWidth = runnerCache.get(device);
  if (!runnersByBucketWidth) {
    runnersByBucketWidth = /* @__PURE__ */ new Map();
    runnerCache.set(device, runnersByBucketWidth);
  }
  let runner = runnersByBucketWidth.get(bucketWidthBits);
  if (!runner) {
    runner = new PippengerMSMPallasRunner(device, bucketWidthBits);
    runnersByBucketWidth.set(bucketWidthBits, runner);
  }
  return runner;
}
var PippengerMSMPallasRunner = class {
  constructor(device, bucketWidthBits) {
    this.batchFinalPointsCapacity = 0;
    this.multiResultCapacity = 0;
    this.device = device;
    this.bucketWidthBits = bucketWidthBits;
    this.numberOfBuckets = 1 << bucketWidthBits;
    this.numWindows = Math.ceil(SCALAR_BITS / bucketWidthBits);
    const maxBufferSize = device.limits.maxStorageBufferBindingSize;
    const maxWorkgroups = 65535;
    this.maxChunkN = Math.min(Math.floor(maxBufferSize / BYTES_PER_ELEMENT_256), maxWorkgroups * WORKGROUP_SIZE_BI1);
    this.maxNumWorkgroupsBi1 = Math.ceil(this.maxChunkN / WORKGROUP_SIZE_BI1);
    this.maxNumWorkgroupsC = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C);
    this.kHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.pxHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.pyHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.layoutPassA = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutBi1Params = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutUniformSingle = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    const layoutPassBi1Input = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }
      ]
    });
    this.layoutWGG = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutBi2Uniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutBucketsStorage = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutCUniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutFStorage = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutUniformNBatchIdx = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutBatchFinalPoints = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutHornerUniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutFinalPoint = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    const shaderModules = {
      A: device.createShaderModule({ code: pippengerShaderPassAProjectiveConversion }),
      Bi1: device.createShaderModule({ code: pippengerShaderPassBi1BucketScalarWeightedPointContribution }),
      Bi2: device.createShaderModule({ code: pippengerShaderPassBi2TreeReduceBucket }),
      C: device.createShaderModule({ code: pippengerShaderPassCBucketAggregation }),
      D: device.createShaderModule({ code: pippengerShaderPassDTreeReduceFinalPoint }),
      E: device.createShaderModule({ code: pippengerShaderPassEFinalAccumulation }),
      Horner: device.createShaderModule({ code: pippengerShaderPassHorner })
    };
    this.pipelineA = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.layoutPassA] }),
      compute: { module: shaderModules.A, entryPoint: "main" }
    });
    this.pipelineBi1 = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutBi1Params,
          this.layoutUniformSingle,
          layoutPassBi1Input,
          this.layoutWGG
        ]
      }),
      compute: { module: shaderModules.Bi1, entryPoint: "main" }
    });
    this.pipelineBi2 = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutBi2Uniforms,
          this.layoutUniformSingle,
          this.layoutWGG,
          this.layoutBucketsStorage
        ]
      }),
      compute: { module: shaderModules.Bi2, entryPoint: "main" }
    });
    this.pipelineC = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.layoutCUniforms, this.layoutBucketsStorage, this.layoutFStorage]
      }),
      compute: { module: shaderModules.C, entryPoint: "main" }
    });
    this.pipelineD = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutUniformNBatchIdx,
          this.layoutFStorage,
          this.layoutBatchFinalPoints
        ]
      }),
      compute: { module: shaderModules.D, entryPoint: "main" }
    });
    this.pipelineE = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutUniformSingle,
          this.layoutBatchFinalPoints,
          this.layoutFinalPoint
        ]
      }),
      compute: { module: shaderModules.E, entryPoint: "main" }
    });
    this.pipelineHorner = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutHornerUniforms,
          this.layoutFStorage,
          this.layoutBatchFinalPoints
        ]
      }),
      compute: { module: shaderModules.Horner, entryPoint: "main" }
    });
    const bBufferSize = this.numWindows * this.numberOfBuckets * BYTES_PER_ELEMENT_256;
    this.bXBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.bYBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.bZBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.fWindowsXBuffer = this.createBuffer(this.numWindows * BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.fWindowsYBuffer = this.createBuffer(this.numWindows * BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.fWindowsZBuffer = this.createBuffer(this.numWindows * BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.finalPointXBuffer = this.createBuffer(BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.finalPointYBuffer = this.createBuffer(BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.finalPointXStagingBuffer = this.createBuffer(BYTES_PER_ELEMENT_256, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    this.finalPointYStagingBuffer = this.createBuffer(BYTES_PER_ELEMENT_256, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    const u32Size = 4;
    this.bi1BucketWidthBitsBuffer = this.createUniformBufferWithData([bucketWidthBits]);
    this.bi1WindowIdxBuffer = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.bucketIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.bi2UniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passANUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.cUniformsBuffer = this.createBuffer(8, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passDNUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passDBatchIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passENUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.hornerUniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    const perBatchBufferSize = this.maxChunkN * BYTES_PER_ELEMENT_256;
    this.kBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.pxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.pyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.ppxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.ppyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.ppzBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const wggSizeMax = this.maxNumWorkgroupsBi1 * BYTES_PER_ELEMENT_256;
    this.wggXBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.wggYBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.wggZBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const fBufferSizeMax = this.maxNumWorkgroupsC * BYTES_PER_ELEMENT_256;
    this.fXBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fYBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fZBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.bindGroupPassA = device.createBindGroup({
      layout: this.layoutPassA,
      entries: [
        { binding: 0, resource: { buffer: this.pxBuffer } },
        { binding: 1, resource: { buffer: this.pyBuffer } },
        { binding: 2, resource: { buffer: this.ppxBuffer } },
        { binding: 3, resource: { buffer: this.ppyBuffer } },
        { binding: 4, resource: { buffer: this.ppzBuffer } },
        { binding: 5, resource: { buffer: this.passANUniform } }
      ]
    });
    this.bindGroupBi1Params = device.createBindGroup({
      layout: this.layoutBi1Params,
      entries: [
        { binding: 0, resource: { buffer: this.bi1BucketWidthBitsBuffer } },
        { binding: 1, resource: { buffer: this.bi1WindowIdxBuffer } }
      ]
    });
    this.bindGroupBucketIdx = device.createBindGroup({
      layout: this.layoutUniformSingle,
      entries: [{ binding: 0, resource: { buffer: this.bucketIdxUniform } }]
    });
    this.bindGroupPassBi1Input = device.createBindGroup({
      layout: layoutPassBi1Input,
      entries: [
        { binding: 0, resource: { buffer: this.kBuffer } },
        { binding: 1, resource: { buffer: this.ppxBuffer } },
        { binding: 2, resource: { buffer: this.ppyBuffer } },
        { binding: 3, resource: { buffer: this.ppzBuffer } }
      ]
    });
    this.bindGroupWGG = device.createBindGroup({
      layout: this.layoutWGG,
      entries: [
        { binding: 0, resource: { buffer: this.wggXBuffer } },
        { binding: 1, resource: { buffer: this.wggYBuffer } },
        { binding: 2, resource: { buffer: this.wggZBuffer } }
      ]
    });
    this.bindGroupBi2Uniforms = device.createBindGroup({
      layout: this.layoutBi2Uniforms,
      entries: [{ binding: 0, resource: { buffer: this.bi2UniformsBuffer } }]
    });
    this.bindGroupBucketsStorage = device.createBindGroup({
      layout: this.layoutBucketsStorage,
      entries: [
        { binding: 0, resource: { buffer: this.bXBuffer } },
        { binding: 1, resource: { buffer: this.bYBuffer } },
        { binding: 2, resource: { buffer: this.bZBuffer } }
      ]
    });
    this.bindGroupCUniforms = device.createBindGroup({
      layout: this.layoutCUniforms,
      entries: [{ binding: 0, resource: { buffer: this.cUniformsBuffer } }]
    });
    this.bindGroupFStorage = device.createBindGroup({
      layout: this.layoutFStorage,
      entries: [
        { binding: 0, resource: { buffer: this.fXBuffer } },
        { binding: 1, resource: { buffer: this.fYBuffer } },
        { binding: 2, resource: { buffer: this.fZBuffer } }
      ]
    });
    this.bindGroupPassDUniforms = device.createBindGroup({
      layout: this.layoutUniformNBatchIdx,
      entries: [
        { binding: 0, resource: { buffer: this.passDNUniform } },
        { binding: 1, resource: { buffer: this.passDBatchIdxUniform } }
      ]
    });
    this.bindGroupFWindowsOutput = device.createBindGroup({
      layout: this.layoutBatchFinalPoints,
      entries: [
        { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
        { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
        { binding: 2, resource: { buffer: this.fWindowsZBuffer } }
      ]
    });
    this.bindGroupHornerUniforms = device.createBindGroup({
      layout: this.layoutHornerUniforms,
      entries: [{ binding: 0, resource: { buffer: this.hornerUniformsBuffer } }]
    });
    this.bindGroupFWindowsInput = device.createBindGroup({
      layout: this.layoutFStorage,
      entries: [
        { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
        { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
        { binding: 2, resource: { buffer: this.fWindowsZBuffer } }
      ]
    });
    this.bindGroupPassEN = device.createBindGroup({
      layout: this.layoutUniformSingle,
      entries: [{ binding: 0, resource: { buffer: this.passENUniform } }]
    });
    this.bindGroupFinalPoint = device.createBindGroup({
      layout: this.layoutFinalPoint,
      entries: [
        { binding: 0, resource: { buffer: this.finalPointXBuffer } },
        { binding: 1, resource: { buffer: this.finalPointYBuffer } }
      ]
    });
  }
  async run(scalars, points, config) {
    const [result] = await this.runMany([{ scalars, points }], config);
    return result;
  }
  async runMany(jobs, config) {
    if (jobs.length === 0)
      throw new Error("jobs array cannot be empty");
    const verbose = config?.verbose ?? true;
    this.ensureMultiResultCapacity(jobs.length);
    let passCountA = 0;
    let passCountBi1 = 0;
    let passCountBi2 = 0;
    let passCountC = 0;
    let passCountD = 0;
    let passCountHorner = 0;
    let passCountE = 0;
    let commandEncoder = this.device.createCommandEncoder();
    for (let jobIdx = 0; jobIdx < jobs.length; jobIdx++) {
      const { scalars, points } = jobs[jobIdx];
      const n = scalars.length;
      if (n === 0)
        throw new Error("scalars and points arrays cannot be empty");
      if (points.length !== n)
        throw new Error("scalars and points must have same length");
      const numBatches = Math.ceil(n / this.maxChunkN);
      this.ensureBatchFinalPointsCapacity(numBatches);
      this.clearReusableState(commandEncoder, numBatches);
      this.device.queue.submit([commandEncoder.finish()]);
      commandEncoder = this.device.createCommandEncoder();
      if (verbose) {
        console.log("=== Pippenger MSM Configuration ===");
        console.log(`Job:                  ${jobs[jobIdx].label ?? jobIdx}`);
        console.log(`Total points:         ${n}`);
        console.log(`Bucket width (bits):  ${this.bucketWidthBits}`);
        console.log(`Number of buckets:    ${this.numberOfBuckets}`);
        console.log(`Number of windows:    ${this.numWindows}`);
        console.log(`Max points per batch: ${this.maxChunkN}`);
        console.log(`Number of batches:    ${numBatches}`);
        console.log("===================================");
      }
      for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
        const batchOffset = batchIdx * this.maxChunkN;
        const currentBatchN = Math.min(n - batchOffset, this.maxChunkN);
        if (verbose) {
          console.log(`Job ${jobIdx + 1}/${jobs.length} batch ${batchIdx + 1}/${numBatches} (${currentBatchN} points)`);
        }
        this.packBatchInputs(scalars, points, batchOffset, currentBatchN);
        const usedHostLimbs = currentBatchN * LIMBS_PER_ELEMENT_256;
        this.device.queue.writeBuffer(this.kBuffer, 0, this.kHost.buffer, 0, usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT);
        this.device.queue.writeBuffer(this.pxBuffer, 0, this.pxHost.buffer, 0, usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT);
        this.device.queue.writeBuffer(this.pyBuffer, 0, this.pyHost.buffer, 0, usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT);
        this.device.queue.writeBuffer(this.passANUniform, 0, new Uint32Array([currentBatchN]));
        {
          const numWG = Math.ceil(currentBatchN / WORKGROUP_SIZE_A);
          const pass = commandEncoder.beginComputePass();
          pass.setPipeline(this.pipelineA);
          pass.setBindGroup(0, this.bindGroupPassA);
          pass.dispatchWorkgroups(numWG);
          pass.end();
          passCountA++;
        }
        const numWorkgroupsBi1 = Math.ceil(currentBatchN / WORKGROUP_SIZE_BI1);
        for (let windowIdx = 0; windowIdx < this.numWindows; windowIdx++) {
          this.device.queue.writeBuffer(this.bi1WindowIdxBuffer, 0, new Uint32Array([windowIdx]));
          for (let bucketValue = 1; bucketValue < this.numberOfBuckets; bucketValue++) {
            this.device.queue.writeBuffer(this.bucketIdxUniform, 0, new Uint32Array([bucketValue]));
            {
              const pass = commandEncoder.beginComputePass();
              pass.setPipeline(this.pipelineBi1);
              pass.setBindGroup(0, this.bindGroupBi1Params);
              pass.setBindGroup(1, this.bindGroupBucketIdx);
              pass.setBindGroup(2, this.bindGroupPassBi1Input);
              pass.setBindGroup(3, this.bindGroupWGG);
              pass.dispatchWorkgroups(numWorkgroupsBi1);
              pass.end();
              passCountBi1++;
            }
            let currentNBi2 = numWorkgroupsBi1;
            while (currentNBi2 >= 1) {
              this.device.queue.writeBuffer(this.bi2UniformsBuffer, 0, new Uint32Array([currentNBi2, windowIdx, this.numberOfBuckets, 0]));
              const numWG = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI2);
              const pass = commandEncoder.beginComputePass();
              pass.setPipeline(this.pipelineBi2);
              pass.setBindGroup(0, this.bindGroupBi2Uniforms);
              pass.setBindGroup(1, this.bindGroupBucketIdx);
              pass.setBindGroup(2, this.bindGroupWGG);
              pass.setBindGroup(3, this.bindGroupBucketsStorage);
              pass.dispatchWorkgroups(numWG);
              pass.end();
              passCountBi2++;
              if (currentNBi2 <= WORKGROUP_SIZE_BI2)
                break;
              currentNBi2 = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI2);
            }
            this.device.queue.submit([commandEncoder.finish()]);
            commandEncoder = this.device.createCommandEncoder();
          }
          this.device.queue.writeBuffer(this.cUniformsBuffer, 0, new Uint32Array([windowIdx, this.numberOfBuckets]));
          {
            const numWG = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C);
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.pipelineC);
            pass.setBindGroup(0, this.bindGroupCUniforms);
            pass.setBindGroup(1, this.bindGroupBucketsStorage);
            pass.setBindGroup(2, this.bindGroupFStorage);
            pass.dispatchWorkgroups(numWG);
            pass.end();
            passCountC++;
          }
          let currentND = this.maxNumWorkgroupsC;
          while (currentND >= 1) {
            this.device.queue.writeBuffer(this.passDNUniform, 0, new Uint32Array([currentND]));
            this.device.queue.writeBuffer(this.passDBatchIdxUniform, 0, new Uint32Array([windowIdx]));
            const numWG = Math.ceil(currentND / WORKGROUP_SIZE_D);
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.pipelineD);
            pass.setBindGroup(0, this.bindGroupPassDUniforms);
            pass.setBindGroup(1, this.bindGroupFStorage);
            pass.setBindGroup(2, this.bindGroupFWindowsOutput);
            pass.dispatchWorkgroups(numWG);
            pass.end();
            passCountD++;
            if (currentND <= WORKGROUP_SIZE_D)
              break;
            currentND = Math.ceil(currentND / WORKGROUP_SIZE_D);
          }
          this.device.queue.submit([commandEncoder.finish()]);
          commandEncoder = this.device.createCommandEncoder();
        }
        this.device.queue.writeBuffer(this.hornerUniformsBuffer, 0, new Uint32Array([this.numWindows, this.bucketWidthBits, batchIdx, 0]));
        {
          const pass = commandEncoder.beginComputePass();
          pass.setPipeline(this.pipelineHorner);
          pass.setBindGroup(0, this.bindGroupHornerUniforms);
          pass.setBindGroup(1, this.bindGroupFWindowsInput);
          pass.setBindGroup(2, this.bindGroupBatchFinalPoints);
          pass.dispatchWorkgroups(1);
          pass.end();
          passCountHorner++;
        }
        this.device.queue.submit([commandEncoder.finish()]);
        commandEncoder = this.device.createCommandEncoder();
      }
      let currentNE = numBatches;
      while (currentNE >= 1) {
        this.device.queue.writeBuffer(this.passENUniform, 0, new Uint32Array([currentNE]));
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipelineE);
        pass.setBindGroup(0, this.bindGroupPassEN);
        pass.setBindGroup(1, this.bindGroupBatchFinalPoints);
        pass.setBindGroup(2, this.bindGroupFinalPoint);
        pass.dispatchWorkgroups(Math.ceil(currentNE / WORKGROUP_SIZE_E));
        pass.end();
        passCountE++;
        if (currentNE <= WORKGROUP_SIZE_E)
          break;
        currentNE = Math.ceil(currentNE / WORKGROUP_SIZE_E);
      }
      commandEncoder.copyBufferToBuffer(this.finalPointXBuffer, 0, this.multiResultXBuffer, jobIdx * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
      commandEncoder.copyBufferToBuffer(this.finalPointYBuffer, 0, this.multiResultYBuffer, jobIdx * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    }
    commandEncoder.copyBufferToBuffer(this.multiResultXBuffer, 0, this.multiResultXStagingBuffer, 0, jobs.length * BYTES_PER_ELEMENT_256);
    commandEncoder.copyBufferToBuffer(this.multiResultYBuffer, 0, this.multiResultYStagingBuffer, 0, jobs.length * BYTES_PER_ELEMENT_256);
    if (verbose) {
      console.log("\n--- Dispatches per Stage ---");
      console.log(`Pass A:      ${passCountA}`);
      console.log(`Pass Bi1:    ${passCountBi1}`);
      console.log(`Pass Bi2:    ${passCountBi2}`);
      console.log(`Pass C:      ${passCountC}`);
      console.log(`Pass D:      ${passCountD}`);
      console.log(`Pass Horner: ${passCountHorner}`);
      console.log(`Pass E:      ${passCountE}`);
      console.log(`TOTAL:       ${passCountA + passCountBi1 + passCountBi2 + passCountC + passCountD + passCountHorner + passCountE}`);
      console.log("============================\n");
    }
    this.device.queue.submit([commandEncoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    await this.multiResultXStagingBuffer.mapAsync(GPUMapMode.READ);
    await this.multiResultYStagingBuffer.mapAsync(GPUMapMode.READ);
    const xView = new Uint32Array(this.multiResultXStagingBuffer.getMappedRange()).slice();
    const yView = new Uint32Array(this.multiResultYStagingBuffer.getMappedRange()).slice();
    this.multiResultXStagingBuffer.unmap();
    this.multiResultYStagingBuffer.unmap();
    const results = [];
    for (let jobIdx = 0; jobIdx < jobs.length; jobIdx++) {
      const offset = jobIdx * LIMBS_PER_ELEMENT_256;
      results.push({
        x: limbs256ToBigint(xView.subarray(offset, offset + LIMBS_PER_ELEMENT_256)),
        y: limbs256ToBigint(yView.subarray(offset, offset + LIMBS_PER_ELEMENT_256))
      });
    }
    return results;
  }
  destroy() {
    this.batchFinalPointsXBuffer?.destroy();
    this.batchFinalPointsYBuffer?.destroy();
    this.batchFinalPointsZBuffer?.destroy();
  }
  packBatchInputs(scalars, points, batchOffset, currentBatchN) {
    for (let i = 0; i < currentBatchN; i++) {
      const sourceIndex = batchOffset + i;
      const targetOffset = i * LIMBS_PER_ELEMENT_256;
      writeBigint256ToLimbs(scalars[sourceIndex], this.kHost, targetOffset);
      writeBigint256ToLimbs(points[sourceIndex].x, this.pxHost, targetOffset);
      writeBigint256ToLimbs(points[sourceIndex].y, this.pyHost, targetOffset);
    }
  }
  ensureBatchFinalPointsCapacity(numBatches) {
    if (numBatches <= this.batchFinalPointsCapacity) {
      return;
    }
    this.batchFinalPointsXBuffer?.destroy();
    this.batchFinalPointsYBuffer?.destroy();
    this.batchFinalPointsZBuffer?.destroy();
    const batchFinalPointsSize = Math.max(numBatches * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    this.batchFinalPointsXBuffer = this.createBuffer(batchFinalPointsSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.batchFinalPointsYBuffer = this.createBuffer(batchFinalPointsSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.batchFinalPointsZBuffer = this.createBuffer(batchFinalPointsSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.bindGroupBatchFinalPoints = this.device.createBindGroup({
      layout: this.layoutBatchFinalPoints,
      entries: [
        { binding: 0, resource: { buffer: this.batchFinalPointsXBuffer } },
        { binding: 1, resource: { buffer: this.batchFinalPointsYBuffer } },
        { binding: 2, resource: { buffer: this.batchFinalPointsZBuffer } }
      ]
    });
    this.batchFinalPointsCapacity = numBatches;
  }
  ensureMultiResultCapacity(numJobs) {
    if (numJobs <= this.multiResultCapacity)
      return;
    this.multiResultXBuffer?.destroy();
    this.multiResultYBuffer?.destroy();
    this.multiResultXStagingBuffer?.destroy();
    this.multiResultYStagingBuffer?.destroy();
    const size = Math.max(numJobs * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    this.multiResultXBuffer = this.createBuffer(size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.multiResultYBuffer = this.createBuffer(size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.multiResultXStagingBuffer = this.createBuffer(size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    this.multiResultYStagingBuffer = this.createBuffer(size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    this.multiResultCapacity = numJobs;
  }
  clearReusableState(commandEncoder, numBatches) {
    const batchBytes = Math.max(numBatches * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    commandEncoder.clearBuffer(this.bXBuffer);
    commandEncoder.clearBuffer(this.bYBuffer);
    commandEncoder.clearBuffer(this.bZBuffer);
    commandEncoder.clearBuffer(this.fWindowsXBuffer);
    commandEncoder.clearBuffer(this.fWindowsYBuffer);
    commandEncoder.clearBuffer(this.fWindowsZBuffer);
    commandEncoder.clearBuffer(this.batchFinalPointsXBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.batchFinalPointsYBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.batchFinalPointsZBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.finalPointXBuffer);
    commandEncoder.clearBuffer(this.finalPointYBuffer);
  }
  createBuffer(size, usage) {
    return this.device.createBuffer({ size, usage });
  }
  createUniformBufferWithData(values) {
    const buffer = this.device.createBuffer({
      size: values.length * 4,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true
    });
    new Uint32Array(buffer.getMappedRange()).set(values);
    buffer.unmap();
    return buffer;
  }
};

// dist/src/gpu/256bit/vesta/curve.wgsl
var curve_default2 = "// curve.wgsl\n\n// @import types.wgsl\n\n// Vesta curve equation: y\xB2 = x\xB3 + 5\n\n// Vesta prime modulus (field size)\nconst PALLAS_P: array<u32, 8> = array<u32, 8>(\n    0x00000001u, 0x8C46EB21u, 0x0994A8DDu, 0x224698FCu,\n    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u\n);\n\n// Vesta R\xB2 mod p, used to convert numbers into Montgomery form for fast arithmetic\nconst PALLAS_R2: array<u32, 8> = array<u32, 8>(\n    0x0000000Fu, 0xFC9678FFu, 0x891A16E3u, 0x67BB433Du,\n    0x04CCF590u, 0x7FAE2310u, 0x7CCFDAA9u, 0x096D41AFu\n);\n\n// Pallas -p\u207B\xB9 mod 2^32, required for Montgomery reduction in field operations  \nconst PALLAS_MONT_INV32: u32 = 0xffffffffu;\n\n// Vesta curve coefficient 'a' in y\xB2 = x\xB3 + a*x + b (here a = 0 for Vesta)\nconst PALLAS_A: array<u32, 8> = array<u32, 8>(\n    0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u\n);\n\n// Vesta curve coefficient 'b' in y\xB2 = x\xB3 + a*x + b (here b = 5 for Vesta)\nconst PALLAS_B: array<u32, 8> = array<u32, 8>(\n    0u, 0u, 0u, 0u, 0u, 0u, 0u, 5u\n);\n\n// Vesta p - 2, used for modular inverse computation\nconst PALLAS_P_MINUS_2: array<u32, 8> = array<u32, 8>(\n    0xFFFFFFFFu, 0x8C46EB20u, 0x0994A8DDu, 0x224698FCu,\n    0x00000000u, 0x00000000u, 0x00000000u, 0x40000000u\n);\n\n// Vesta r_mod_p : Montgomery representation of 1 (R mod p), used to initialize Z in projective points\nconst PALLAS_R_MOD_P: array<u32, 8> = array<u32, 8>(\n    0xFFFFFFFDu, 0x5B2B3E9Cu, 0xE3420567u, 0x992C350Bu,\n    0xFFFFFFFFu, 0xFFFFFFFFu, 0xFFFFFFFFu, 0x3FFFFFFFu\n);\n\n// Complete Vesta curve parameters as a Curve256 instance\nconst PALLAS_CURVE: Curve256 = Curve256(PALLAS_P, PALLAS_R2, PALLAS_MONT_INV32, PALLAS_A, PALLAS_B, PALLAS_P_MINUS_2, PALLAS_R_MOD_P);\n";

// dist/src/gpu/256bit/vesta/pippenger_msm.wgslc.js
var pippengerShaderPassAProjectiveConversion2 = `
${types_default}
${arithmetic_default}
${curve_default2}

@group(0) @binding(0) var<storage, read> x: array<Limbs256>;
@group(0) @binding(1) var<storage, read> y: array<Limbs256>;
@group(0) @binding(2) var<storage, read_write> Px: array<Limbs256>;
@group(0) @binding(3) var<storage, read_write> Py: array<Limbs256>;
@group(0) @binding(4) var<storage, read_write> Pz: array<Limbs256>;
@group(0) @binding(5) var<uniform> n: u32; 

const WORKGROUP_SIZE: u32 = 64u;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let idx = gid.x;
    
    if (idx >= n) {
        return;
    }
    
    let P = to_projective_256(x[idx], y[idx], PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
    Px[idx] = P.x;
    Py[idx] = P.y;
    Pz[idx] = P.z;
}
`;
var pippengerShaderPassBi1BucketScalarWeightedPointContribution2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Group 0: constant parameters (BUCKET_WIDTH_BITS never changes, window_idx changes per window)
@group(0) @binding(0) var<uniform> BUCKET_WIDTH_BITS: u32;
@group(0) @binding(1) var<uniform> window_idx: u32;

@group(1) @binding(0) var<uniform> bucket_idx: u32;

@group(2) @binding(0) var<storage, read> k: array<Limbs256>;
@group(2) @binding(1) var<storage, read> Px: array<Limbs256>;
@group(2) @binding(2) var<storage, read> Py: array<Limbs256>;
@group(2) @binding(3) var<storage, read> Pz: array<Limbs256>;

@group(3) @binding(0) var<storage, read_write> WGGx: array<Limbs256>;
@group(3) @binding(1) var<storage, read_write> WGGy: array<Limbs256>;
@group(3) @binding(2) var<storage, read_write> WGGz: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, 64>;
var<workgroup> WGLy: array<Limbs256, 64>;
var<workgroup> WGLz: array<Limbs256, 64>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let workgroup_idx = wgid.x;
    let local_idx = gid.x % WORKGROUP_SIZE;

    // Initialize workgroup memory with identity points for all threads
    WGLx[local_idx] = IDENTITY_LIMBS_256;
    WGLy[local_idx] = IDENTITY_LIMBS_256;
    WGLz[local_idx] = IDENTITY_LIMBS_256;

    workgroupBarrier();

    // Only process valid indices, but all threads participate in reduction
    if (idx < arrayLength(&k)) {
        // Extract the scalar bits for this window (window_idx) \u2014 NOT bucket_idx.
        // bucket_idx is the VALUE we are looking for within this window.
        let bit_offset = window_idx * BUCKET_WIDTH_BITS;
        let limb_index = bit_offset / 32u;
        let bit_in_limb = bit_offset % 32u;
        let mask = (1u << BUCKET_WIDTH_BITS) - 1u;

        var k_ij = 0u;
        if (bit_in_limb + BUCKET_WIDTH_BITS) <= 32u {
            k_ij = (k[idx].limbs[limb_index] >> bit_in_limb) & mask;
        } else {
            let bits_in_first_limb = 32u - bit_in_limb;
            let low_bits = k[idx].limbs[limb_index] >> bit_in_limb;
            let high_bits = k[idx].limbs[limb_index + 1u] << bits_in_first_limb;
            k_ij = (low_bits | high_bits) & mask;
        }

        if (k_ij == bucket_idx) {
            WGLx[local_idx] = Px[idx];
            WGLy[local_idx] = Py[idx];
            WGLz[local_idx] = Pz[idx];
        }
    }
    
    workgroupBarrier();

    // Tree reduce the workgroup memory bucket values by binary halving
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Set the global buffer based on the value of WGL_x,y,z[0] which contains the reduction
    if (local_idx == 0) {
        WGGx[workgroup_idx] = WGLx[0];
        WGGy[workgroup_idx] = WGLy[0];
        WGGz[workgroup_idx] = WGLz[0];
    }
}
`;
var pippengerShaderPassBi2TreeReduceBucket2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Group 0: reduction parameters \u2014 packed into one uniform struct to minimise bind-group slots.
struct Bi2Uniforms {
    n: u32,                 // WGG elements to reduce in this dispatch
    window_idx: u32,        // which window we are processing
    number_of_buckets: u32, // NUMBER_OF_BUCKETS = 1 << BUCKET_WIDTH_BITS
}
@group(0) @binding(0) var<uniform> bi2: Bi2Uniforms;

@group(1) @binding(0) var<uniform> bucket_idx: u32;

@group(2) @binding(0) var<storage, read_write> WGGx: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> WGGy: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> WGGz: array<Limbs256>;

@group(3) @binding(0) var<storage, read_write> Bx: array<Limbs256>;
@group(3) @binding(1) var<storage, read_write> By: array<Limbs256>;
@group(3) @binding(2) var<storage, read_write> Bz: array<Limbs256>;

// 64 threads \xD7 3 coordinates \xD7 8 limbs \xD7 4 bytes = 6,144 bytes \u2014 well within the 16 KB limit.
const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;
    let n = bi2.n;

    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) {
        return;
    }

    // Load WGG into workgroup-local memory, padding out-of-bounds with identity.
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = WGGx[idx];
        WGLy[local_idx] = WGGy[idx];
        WGLz[local_idx] = WGGz[idx];
    }

    workgroupBarrier(); // ensure all loads are visible before reduction starts

    // Standard binary tree reduction: stride halves each step.
    // FIX: was using "half = stride >> 1" as the partner offset which skipped the upper
    // half of the workgroup entirely.  The correct partner is local_idx + stride.
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Thread 0 writes its workgroup's reduced result back to WGG.
    if (local_idx == 0u) {
        WGGx[workgroup_idx] = WGLx[0u];
        WGGy[workgroup_idx] = WGLy[0u];
        WGGz[workgroup_idx] = WGLz[0u];
    }

    // For the final pass (n fits in one workgroup), store the bucket result.
    // FIX: index into B using the 2-D (window, bucket) layout instead of a flat bucket_idx.
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        let b_idx = bi2.window_idx * bi2.number_of_buckets + bucket_idx;
        Bx[b_idx] = WGGx[0u];
        By[b_idx] = WGGy[0u];
        Bz[b_idx] = WGGz[0u];
    }
}
`;
var pippengerShaderPassCBucketAggregation2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Group 0: per-window uniform parameters.
struct CUniforms {
    window_idx: u32,        // which window's buckets to aggregate
    number_of_buckets: u32, // NUMBER_OF_BUCKETS = 1 << BUCKET_WIDTH_BITS
}
@group(0) @binding(0) var<uniform> cu: CUniforms;

// B is now NUM_WINDOWS * NUMBER_OF_BUCKETS in size.
// B[window_idx * number_of_buckets + v] = sum of P_i where window w of scalar k_i equals v.
@group(1) @binding(0) var<storage, read_write> Bx: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> By: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> Bz: array<Limbs256>;

// F receives partial weighted sums (one entry per workgroup).
@group(2) @binding(0) var<storage, read_write> Fx: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> Fy: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> Fz: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;
var<workgroup> scaled: array<ProjectivePoint256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;       // bucket value v within this window (0 .. number_of_buckets-1)
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;
    let NB = cu.number_of_buckets;

    let workgroups_needed = (NB + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) {
        return;
    }

    // Step 1: Load B[window_idx * NB + idx] and apply Pippenger weight = idx (the bucket value).
    // Bucket 0 contributes nothing (scalar bits = 0 means the point is not in this bucket window).
    // FIX: weight = idx (the bucket value v), NOT NUM_BUCKETS - idx.
    if (idx == 0u || idx >= NB) {
        // Bucket 0 has weight 0; out-of-range threads hold identity.
        scaled[local_idx] = ProjectivePoint256(IDENTITY_LIMBS_256, IDENTITY_LIMBS_256, IDENTITY_LIMBS_256);
    } else {
        let b_idx = cu.window_idx * NB + idx;
        var weight = idx; // weight = bucket value v (1 .. NB-1)
        var accumulator = ProjectivePoint256(IDENTITY_LIMBS_256, IDENTITY_LIMBS_256, IDENTITY_LIMBS_256);
        var temp = ProjectivePoint256(Bx[b_idx], By[b_idx], Bz[b_idx]);

        // Binary scalar multiplication: weight * B[window_idx * NB + v]
        while (weight > 0u) {
            if ((weight & 1u) != 0u) {
                accumulator = point_add_proj_256(
                    accumulator, temp,
                    PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
                );
            }
            weight = weight >> 1u;
            if (weight > 0u) {
                temp = point_double_proj_256(
                    temp,
                    PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
                );
            }
        }
        scaled[local_idx] = accumulator;
    }

    workgroupBarrier();

    // Step 2: Tree reduction \u2014 sum all weighted bucket contributions within the workgroup.
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            scaled[local_idx] = point_add_proj_256(
                scaled[local_idx],
                scaled[local_idx + stride],
                PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p
            );
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Step 3: Thread 0 writes the partial weighted sum to F.
    // Pass D will reduce F[0..ceil(NB/64)-1] into a single S_w for this window.
    if (local_idx == 0u) {
        Fx[workgroup_idx] = scaled[0u].x;
        Fy[workgroup_idx] = scaled[0u].y;
        Fz[workgroup_idx] = scaled[0u].z;
    }
}
`;
var pippengerShaderPassDTreeReduceFinalPoint2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Uniform: number of points to reduce in this dispatch
@group(0) @binding(0) var<uniform> n: u32;
@group(0) @binding(1) var<uniform> batch_idx: u32;

// Storage: partially reduced points from Pass C
@group(1) @binding(0) var<storage, read_write> Fx: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> Fy: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> Fz: array<Limbs256>;

// Storage for batch final points (projective) - one per batch processed
@group(2) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;

    // Number of workgroups needed
    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) { 
        return; // We don't need these threads
    }

    // Load points into local workgroup memory
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = Fx[idx];
        WGLy[local_idx] = Fy[idx];
        WGLz[local_idx] = Fz[idx];
    }

    workgroupBarrier();

    // Tree reduction within workgroup
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Local thread 0 writes reduced result back to global Fx/y/z
    if (local_idx == 0u) {
        Fx[workgroup_idx] = WGLx[0];
        Fy[workgroup_idx] = WGLy[0];
        Fz[workgroup_idx] = WGLz[0];
    }

    // For the final pass (single workgroup), first global thread writes output
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        batch_final_points_x[batch_idx] = Fx[0];
        batch_final_points_y[batch_idx] = Fy[0];
        batch_final_points_z[batch_idx] = Fz[0];
    }
}
`;
var pippengerShaderPassEFinalAccumulation2 = `
${types_default}
${arithmetic_default}
${curve_default2}

// Uniform: number of batch final points to reduce in this dispatch
@group(0) @binding(0) var<uniform> n: u32;

// Storage: batch final points from Pass D (projective)
@group(1) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

// Storage for final affine point
@group(2) @binding(0) var<storage, read_write> final_point_x: Limbs256;
@group(2) @binding(1) var<storage, read_write> final_point_y: Limbs256;

const WORKGROUP_SIZE: u32 = 64u;

var<workgroup> WGLx: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLy: array<Limbs256, WORKGROUP_SIZE>;
var<workgroup> WGLz: array<Limbs256, WORKGROUP_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wgid: vec3<u32>) {
    let idx = gid.x;
    let local_idx = lid.x;
    let workgroup_idx = wgid.x;

    // Number of workgroups needed
    let workgroups_needed = (n + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    if (workgroup_idx >= workgroups_needed) { 
        return; // We don't need these threads
    }

    // Load batch final points into local workgroup memory
    if (idx >= n) {
        WGLx[local_idx] = IDENTITY_LIMBS_256;
        WGLy[local_idx] = IDENTITY_LIMBS_256;
        WGLz[local_idx] = IDENTITY_LIMBS_256;
    } else {
        WGLx[local_idx] = batch_final_points_x[idx];
        WGLy[local_idx] = batch_final_points_y[idx];
        WGLz[local_idx] = batch_final_points_z[idx];
    }

    workgroupBarrier();

    // Tree reduction within workgroup
    var stride = WORKGROUP_SIZE / 2u;
    while (stride > 0u) {
        if (local_idx < stride) {
            let temp = point_add_proj_256(
                ProjectivePoint256(WGLx[local_idx], WGLy[local_idx], WGLz[local_idx]),
                ProjectivePoint256(WGLx[local_idx + stride], WGLy[local_idx + stride], WGLz[local_idx + stride]),
                PALLAS_CURVE.r2,
                PALLAS_CURVE.mont_inv32,
                PALLAS_CURVE.p
            );
            WGLx[local_idx] = temp.x;
            WGLy[local_idx] = temp.y;
            WGLz[local_idx] = temp.z;
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    // Local thread 0 writes reduced result back to global batch_final_points
    if (local_idx == 0u) {
        batch_final_points_x[workgroup_idx] = WGLx[0];
        batch_final_points_y[workgroup_idx] = WGLy[0];
        batch_final_points_z[workgroup_idx] = WGLz[0];
    }

    // For the final pass (single workgroup), first global thread converts to affine and writes final output
    if (idx == 0u && n <= WORKGROUP_SIZE) {
        let finalProj = ProjectivePoint256(batch_final_points_x[0], batch_final_points_y[0], batch_final_points_z[0]);
        let finalAffine = to_affine_256(finalProj, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p, PALLAS_CURVE.p_minus_2);
        final_point_x = finalAffine.x;
        final_point_y = finalAffine.y;
    }
}
`;
var pippengerShaderPassHorner2 = `
${types_default}
${arithmetic_default}
${curve_default2}

struct HornerUniforms {
    num_windows: u32,
    bucket_width_bits: u32,
    batch_idx: u32,
}
@group(0) @binding(0) var<uniform> hu: HornerUniforms;

// F_windows[w] = S_w, the weighted bucket sum for window w.
@group(1) @binding(0) var<storage, read_write> fw_x: array<Limbs256>;
@group(1) @binding(1) var<storage, read_write> fw_y: array<Limbs256>;
@group(1) @binding(2) var<storage, read_write> fw_z: array<Limbs256>;

// Output: batch_final_points[batch_idx] = Horner result (projective).
@group(2) @binding(0) var<storage, read_write> batch_final_points_x: array<Limbs256>;
@group(2) @binding(1) var<storage, read_write> batch_final_points_y: array<Limbs256>;
@group(2) @binding(2) var<storage, read_write> batch_final_points_z: array<Limbs256>;

@compute @workgroup_size(1)
fn main() {
    let NW = hu.num_windows;
    let W  = hu.bucket_width_bits;

    // Initialise with the highest window's sum.
    var result = ProjectivePoint256(
        fw_x[NW - 1u],
        fw_y[NW - 1u],
        fw_z[NW - 1u]
    );

    // Horner descent: result = 2^W * result + S_{w}  for w = NW-2 .. 0
    var w: i32 = i32(NW) - 2;
    while (w >= 0) {
        // Multiply result by 2^W via W repeated doublings.
        for (var d = 0u; d < W; d = d + 1u) {
            result = point_double_proj_256(result, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
        }
        // Add S_w.
        let sw = ProjectivePoint256(fw_x[u32(w)], fw_y[u32(w)], fw_z[u32(w)]);
        result = point_add_proj_256(result, sw, PALLAS_CURVE.r2, PALLAS_CURVE.mont_inv32, PALLAS_CURVE.p);
        w = w - 1;
    }

    batch_final_points_x[hu.batch_idx] = result.x;
    batch_final_points_y[hu.batch_idx] = result.y;
    batch_final_points_z[hu.batch_idx] = result.z;
}
`;

// dist/src/gpu/256bit/vesta/pippenger_msm.js
var WORKGROUP_SIZE_A2 = 64;
var WORKGROUP_SIZE_BI12 = 64;
var WORKGROUP_SIZE_BI22 = 64;
var WORKGROUP_SIZE_C2 = 64;
var WORKGROUP_SIZE_D2 = 64;
var WORKGROUP_SIZE_E2 = 64;
var SCALAR_BITS2 = 256;
var runnerCache2 = /* @__PURE__ */ new WeakMap();
function normalizeBucketWidthBits2(config) {
  const bucketWidthBits = config?.bucketWidthBits ?? 8;
  if (bucketWidthBits < 1 || bucketWidthBits > 22) {
    throw new Error("bucketWidthBits must be 1\u201322");
  }
  return bucketWidthBits;
}
function createPippengerMSMVestaRunner(device, config) {
  const bucketWidthBits = normalizeBucketWidthBits2(config);
  let runnersByBucketWidth = runnerCache2.get(device);
  if (!runnersByBucketWidth) {
    runnersByBucketWidth = /* @__PURE__ */ new Map();
    runnerCache2.set(device, runnersByBucketWidth);
  }
  let runner = runnersByBucketWidth.get(bucketWidthBits);
  if (!runner) {
    runner = new PippengerMSMVestaRunner(device, bucketWidthBits);
    runnersByBucketWidth.set(bucketWidthBits, runner);
  }
  return runner;
}
var PippengerMSMVestaRunner = class {
  constructor(device, bucketWidthBits) {
    this.batchFinalPointsCapacity = 0;
    this.multiResultCapacity = 0;
    this.device = device;
    this.bucketWidthBits = bucketWidthBits;
    this.numberOfBuckets = 1 << bucketWidthBits;
    this.numWindows = Math.ceil(SCALAR_BITS2 / bucketWidthBits);
    const maxBufferSize = device.limits.maxStorageBufferBindingSize;
    const maxWorkgroups = 65535;
    this.maxChunkN = Math.min(Math.floor(maxBufferSize / BYTES_PER_ELEMENT_256), maxWorkgroups * WORKGROUP_SIZE_BI12);
    this.maxNumWorkgroupsBi1 = Math.ceil(this.maxChunkN / WORKGROUP_SIZE_BI12);
    this.maxNumWorkgroupsC = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C2);
    this.kHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.pxHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.pyHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
    this.layoutPassA = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutBi1Params = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutUniformSingle = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    const layoutPassBi1Input = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }
      ]
    });
    this.layoutWGG = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutBi2Uniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutBucketsStorage = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutCUniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutFStorage = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutUniformNBatchIdx = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.layoutBatchFinalPoints = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this.layoutHornerUniforms = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }]
    });
    this.layoutFinalPoint = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    const shaderModules = {
      A: device.createShaderModule({ code: pippengerShaderPassAProjectiveConversion2 }),
      Bi1: device.createShaderModule({ code: pippengerShaderPassBi1BucketScalarWeightedPointContribution2 }),
      Bi2: device.createShaderModule({ code: pippengerShaderPassBi2TreeReduceBucket2 }),
      C: device.createShaderModule({ code: pippengerShaderPassCBucketAggregation2 }),
      D: device.createShaderModule({ code: pippengerShaderPassDTreeReduceFinalPoint2 }),
      E: device.createShaderModule({ code: pippengerShaderPassEFinalAccumulation2 }),
      Horner: device.createShaderModule({ code: pippengerShaderPassHorner2 })
    };
    this.pipelineA = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.layoutPassA] }),
      compute: { module: shaderModules.A, entryPoint: "main" }
    });
    this.pipelineBi1 = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutBi1Params,
          this.layoutUniformSingle,
          layoutPassBi1Input,
          this.layoutWGG
        ]
      }),
      compute: { module: shaderModules.Bi1, entryPoint: "main" }
    });
    this.pipelineBi2 = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutBi2Uniforms,
          this.layoutUniformSingle,
          this.layoutWGG,
          this.layoutBucketsStorage
        ]
      }),
      compute: { module: shaderModules.Bi2, entryPoint: "main" }
    });
    this.pipelineC = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.layoutCUniforms, this.layoutBucketsStorage, this.layoutFStorage]
      }),
      compute: { module: shaderModules.C, entryPoint: "main" }
    });
    this.pipelineD = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutUniformNBatchIdx,
          this.layoutFStorage,
          this.layoutBatchFinalPoints
        ]
      }),
      compute: { module: shaderModules.D, entryPoint: "main" }
    });
    this.pipelineE = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutUniformSingle,
          this.layoutBatchFinalPoints,
          this.layoutFinalPoint
        ]
      }),
      compute: { module: shaderModules.E, entryPoint: "main" }
    });
    this.pipelineHorner = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          this.layoutHornerUniforms,
          this.layoutFStorage,
          this.layoutBatchFinalPoints
        ]
      }),
      compute: { module: shaderModules.Horner, entryPoint: "main" }
    });
    const bBufferSize = this.numWindows * this.numberOfBuckets * BYTES_PER_ELEMENT_256;
    this.bXBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.bYBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.bZBuffer = this.createBuffer(bBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.fWindowsXBuffer = this.createBuffer(this.numWindows * BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.fWindowsYBuffer = this.createBuffer(this.numWindows * BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.fWindowsZBuffer = this.createBuffer(this.numWindows * BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.finalPointXBuffer = this.createBuffer(BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.finalPointYBuffer = this.createBuffer(BYTES_PER_ELEMENT_256, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.finalPointXStagingBuffer = this.createBuffer(BYTES_PER_ELEMENT_256, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    this.finalPointYStagingBuffer = this.createBuffer(BYTES_PER_ELEMENT_256, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    const u32Size = 4;
    this.bi1BucketWidthBitsBuffer = this.createUniformBufferWithData([bucketWidthBits]);
    this.bi1WindowIdxBuffer = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.bucketIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.bi2UniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passANUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.cUniformsBuffer = this.createBuffer(8, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passDNUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passDBatchIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.passENUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.hornerUniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    const perBatchBufferSize = this.maxChunkN * BYTES_PER_ELEMENT_256;
    this.kBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.pxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.pyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.ppxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.ppyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.ppzBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const wggSizeMax = this.maxNumWorkgroupsBi1 * BYTES_PER_ELEMENT_256;
    this.wggXBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.wggYBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.wggZBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const fBufferSizeMax = this.maxNumWorkgroupsC * BYTES_PER_ELEMENT_256;
    this.fXBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fYBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.fZBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.bindGroupPassA = device.createBindGroup({
      layout: this.layoutPassA,
      entries: [
        { binding: 0, resource: { buffer: this.pxBuffer } },
        { binding: 1, resource: { buffer: this.pyBuffer } },
        { binding: 2, resource: { buffer: this.ppxBuffer } },
        { binding: 3, resource: { buffer: this.ppyBuffer } },
        { binding: 4, resource: { buffer: this.ppzBuffer } },
        { binding: 5, resource: { buffer: this.passANUniform } }
      ]
    });
    this.bindGroupBi1Params = device.createBindGroup({
      layout: this.layoutBi1Params,
      entries: [
        { binding: 0, resource: { buffer: this.bi1BucketWidthBitsBuffer } },
        { binding: 1, resource: { buffer: this.bi1WindowIdxBuffer } }
      ]
    });
    this.bindGroupBucketIdx = device.createBindGroup({
      layout: this.layoutUniformSingle,
      entries: [{ binding: 0, resource: { buffer: this.bucketIdxUniform } }]
    });
    this.bindGroupPassBi1Input = device.createBindGroup({
      layout: layoutPassBi1Input,
      entries: [
        { binding: 0, resource: { buffer: this.kBuffer } },
        { binding: 1, resource: { buffer: this.ppxBuffer } },
        { binding: 2, resource: { buffer: this.ppyBuffer } },
        { binding: 3, resource: { buffer: this.ppzBuffer } }
      ]
    });
    this.bindGroupWGG = device.createBindGroup({
      layout: this.layoutWGG,
      entries: [
        { binding: 0, resource: { buffer: this.wggXBuffer } },
        { binding: 1, resource: { buffer: this.wggYBuffer } },
        { binding: 2, resource: { buffer: this.wggZBuffer } }
      ]
    });
    this.bindGroupBi2Uniforms = device.createBindGroup({
      layout: this.layoutBi2Uniforms,
      entries: [{ binding: 0, resource: { buffer: this.bi2UniformsBuffer } }]
    });
    this.bindGroupBucketsStorage = device.createBindGroup({
      layout: this.layoutBucketsStorage,
      entries: [
        { binding: 0, resource: { buffer: this.bXBuffer } },
        { binding: 1, resource: { buffer: this.bYBuffer } },
        { binding: 2, resource: { buffer: this.bZBuffer } }
      ]
    });
    this.bindGroupCUniforms = device.createBindGroup({
      layout: this.layoutCUniforms,
      entries: [{ binding: 0, resource: { buffer: this.cUniformsBuffer } }]
    });
    this.bindGroupFStorage = device.createBindGroup({
      layout: this.layoutFStorage,
      entries: [
        { binding: 0, resource: { buffer: this.fXBuffer } },
        { binding: 1, resource: { buffer: this.fYBuffer } },
        { binding: 2, resource: { buffer: this.fZBuffer } }
      ]
    });
    this.bindGroupPassDUniforms = device.createBindGroup({
      layout: this.layoutUniformNBatchIdx,
      entries: [
        { binding: 0, resource: { buffer: this.passDNUniform } },
        { binding: 1, resource: { buffer: this.passDBatchIdxUniform } }
      ]
    });
    this.bindGroupFWindowsOutput = device.createBindGroup({
      layout: this.layoutBatchFinalPoints,
      entries: [
        { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
        { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
        { binding: 2, resource: { buffer: this.fWindowsZBuffer } }
      ]
    });
    this.bindGroupHornerUniforms = device.createBindGroup({
      layout: this.layoutHornerUniforms,
      entries: [{ binding: 0, resource: { buffer: this.hornerUniformsBuffer } }]
    });
    this.bindGroupFWindowsInput = device.createBindGroup({
      layout: this.layoutFStorage,
      entries: [
        { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
        { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
        { binding: 2, resource: { buffer: this.fWindowsZBuffer } }
      ]
    });
    this.bindGroupPassEN = device.createBindGroup({
      layout: this.layoutUniformSingle,
      entries: [{ binding: 0, resource: { buffer: this.passENUniform } }]
    });
    this.bindGroupFinalPoint = device.createBindGroup({
      layout: this.layoutFinalPoint,
      entries: [
        { binding: 0, resource: { buffer: this.finalPointXBuffer } },
        { binding: 1, resource: { buffer: this.finalPointYBuffer } }
      ]
    });
  }
  async run(scalars, points, config) {
    const [result] = await this.runMany([{ scalars, points }], config);
    return result;
  }
  async runMany(jobs, config) {
    if (jobs.length === 0)
      throw new Error("jobs array cannot be empty");
    const verbose = config?.verbose ?? true;
    this.ensureMultiResultCapacity(jobs.length);
    let passCountA = 0;
    let passCountBi1 = 0;
    let passCountBi2 = 0;
    let passCountC = 0;
    let passCountD = 0;
    let passCountHorner = 0;
    let passCountE = 0;
    let commandEncoder = this.device.createCommandEncoder();
    for (let jobIdx = 0; jobIdx < jobs.length; jobIdx++) {
      const { scalars, points } = jobs[jobIdx];
      const n = scalars.length;
      if (n === 0)
        throw new Error("scalars and points arrays cannot be empty");
      if (points.length !== n)
        throw new Error("scalars and points must have same length");
      const numBatches = Math.ceil(n / this.maxChunkN);
      this.ensureBatchFinalPointsCapacity(numBatches);
      this.clearReusableState(commandEncoder, numBatches);
      this.device.queue.submit([commandEncoder.finish()]);
      commandEncoder = this.device.createCommandEncoder();
      if (verbose) {
        console.log("=== Pippenger MSM Configuration ===");
        console.log(`Job:                  ${jobs[jobIdx].label ?? jobIdx}`);
        console.log(`Total points:         ${n}`);
        console.log(`Bucket width (bits):  ${this.bucketWidthBits}`);
        console.log(`Number of buckets:    ${this.numberOfBuckets}`);
        console.log(`Number of windows:    ${this.numWindows}`);
        console.log(`Max points per batch: ${this.maxChunkN}`);
        console.log(`Number of batches:    ${numBatches}`);
        console.log("===================================");
      }
      for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
        const batchOffset = batchIdx * this.maxChunkN;
        const currentBatchN = Math.min(n - batchOffset, this.maxChunkN);
        if (verbose) {
          console.log(`Job ${jobIdx + 1}/${jobs.length} batch ${batchIdx + 1}/${numBatches} (${currentBatchN} points)`);
        }
        this.packBatchInputs(scalars, points, batchOffset, currentBatchN);
        const usedHostLimbs = currentBatchN * LIMBS_PER_ELEMENT_256;
        this.device.queue.writeBuffer(this.kBuffer, 0, this.kHost.buffer, 0, usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT);
        this.device.queue.writeBuffer(this.pxBuffer, 0, this.pxHost.buffer, 0, usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT);
        this.device.queue.writeBuffer(this.pyBuffer, 0, this.pyHost.buffer, 0, usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT);
        this.device.queue.writeBuffer(this.passANUniform, 0, new Uint32Array([currentBatchN]));
        {
          const numWG = Math.ceil(currentBatchN / WORKGROUP_SIZE_A2);
          const pass = commandEncoder.beginComputePass();
          pass.setPipeline(this.pipelineA);
          pass.setBindGroup(0, this.bindGroupPassA);
          pass.dispatchWorkgroups(numWG);
          pass.end();
          passCountA++;
        }
        const numWorkgroupsBi1 = Math.ceil(currentBatchN / WORKGROUP_SIZE_BI12);
        for (let windowIdx = 0; windowIdx < this.numWindows; windowIdx++) {
          this.device.queue.writeBuffer(this.bi1WindowIdxBuffer, 0, new Uint32Array([windowIdx]));
          for (let bucketValue = 1; bucketValue < this.numberOfBuckets; bucketValue++) {
            this.device.queue.writeBuffer(this.bucketIdxUniform, 0, new Uint32Array([bucketValue]));
            {
              const pass = commandEncoder.beginComputePass();
              pass.setPipeline(this.pipelineBi1);
              pass.setBindGroup(0, this.bindGroupBi1Params);
              pass.setBindGroup(1, this.bindGroupBucketIdx);
              pass.setBindGroup(2, this.bindGroupPassBi1Input);
              pass.setBindGroup(3, this.bindGroupWGG);
              pass.dispatchWorkgroups(numWorkgroupsBi1);
              pass.end();
              passCountBi1++;
            }
            let currentNBi2 = numWorkgroupsBi1;
            while (currentNBi2 >= 1) {
              this.device.queue.writeBuffer(this.bi2UniformsBuffer, 0, new Uint32Array([currentNBi2, windowIdx, this.numberOfBuckets, 0]));
              const numWG = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI22);
              const pass = commandEncoder.beginComputePass();
              pass.setPipeline(this.pipelineBi2);
              pass.setBindGroup(0, this.bindGroupBi2Uniforms);
              pass.setBindGroup(1, this.bindGroupBucketIdx);
              pass.setBindGroup(2, this.bindGroupWGG);
              pass.setBindGroup(3, this.bindGroupBucketsStorage);
              pass.dispatchWorkgroups(numWG);
              pass.end();
              passCountBi2++;
              if (currentNBi2 <= WORKGROUP_SIZE_BI22)
                break;
              currentNBi2 = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI22);
            }
            this.device.queue.submit([commandEncoder.finish()]);
            commandEncoder = this.device.createCommandEncoder();
          }
          this.device.queue.writeBuffer(this.cUniformsBuffer, 0, new Uint32Array([windowIdx, this.numberOfBuckets]));
          {
            const numWG = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C2);
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.pipelineC);
            pass.setBindGroup(0, this.bindGroupCUniforms);
            pass.setBindGroup(1, this.bindGroupBucketsStorage);
            pass.setBindGroup(2, this.bindGroupFStorage);
            pass.dispatchWorkgroups(numWG);
            pass.end();
            passCountC++;
          }
          let currentND = this.maxNumWorkgroupsC;
          while (currentND >= 1) {
            this.device.queue.writeBuffer(this.passDNUniform, 0, new Uint32Array([currentND]));
            this.device.queue.writeBuffer(this.passDBatchIdxUniform, 0, new Uint32Array([windowIdx]));
            const numWG = Math.ceil(currentND / WORKGROUP_SIZE_D2);
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.pipelineD);
            pass.setBindGroup(0, this.bindGroupPassDUniforms);
            pass.setBindGroup(1, this.bindGroupFStorage);
            pass.setBindGroup(2, this.bindGroupFWindowsOutput);
            pass.dispatchWorkgroups(numWG);
            pass.end();
            passCountD++;
            if (currentND <= WORKGROUP_SIZE_D2)
              break;
            currentND = Math.ceil(currentND / WORKGROUP_SIZE_D2);
          }
          this.device.queue.submit([commandEncoder.finish()]);
          commandEncoder = this.device.createCommandEncoder();
        }
        this.device.queue.writeBuffer(this.hornerUniformsBuffer, 0, new Uint32Array([this.numWindows, this.bucketWidthBits, batchIdx, 0]));
        {
          const pass = commandEncoder.beginComputePass();
          pass.setPipeline(this.pipelineHorner);
          pass.setBindGroup(0, this.bindGroupHornerUniforms);
          pass.setBindGroup(1, this.bindGroupFWindowsInput);
          pass.setBindGroup(2, this.bindGroupBatchFinalPoints);
          pass.dispatchWorkgroups(1);
          pass.end();
          passCountHorner++;
        }
        this.device.queue.submit([commandEncoder.finish()]);
        commandEncoder = this.device.createCommandEncoder();
      }
      let currentNE = numBatches;
      while (currentNE >= 1) {
        this.device.queue.writeBuffer(this.passENUniform, 0, new Uint32Array([currentNE]));
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipelineE);
        pass.setBindGroup(0, this.bindGroupPassEN);
        pass.setBindGroup(1, this.bindGroupBatchFinalPoints);
        pass.setBindGroup(2, this.bindGroupFinalPoint);
        pass.dispatchWorkgroups(Math.ceil(currentNE / WORKGROUP_SIZE_E2));
        pass.end();
        passCountE++;
        if (currentNE <= WORKGROUP_SIZE_E2)
          break;
        currentNE = Math.ceil(currentNE / WORKGROUP_SIZE_E2);
      }
      commandEncoder.copyBufferToBuffer(this.finalPointXBuffer, 0, this.multiResultXBuffer, jobIdx * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
      commandEncoder.copyBufferToBuffer(this.finalPointYBuffer, 0, this.multiResultYBuffer, jobIdx * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    }
    commandEncoder.copyBufferToBuffer(this.multiResultXBuffer, 0, this.multiResultXStagingBuffer, 0, jobs.length * BYTES_PER_ELEMENT_256);
    commandEncoder.copyBufferToBuffer(this.multiResultYBuffer, 0, this.multiResultYStagingBuffer, 0, jobs.length * BYTES_PER_ELEMENT_256);
    if (verbose) {
      console.log("\n--- Dispatches per Stage ---");
      console.log(`Pass A:      ${passCountA}`);
      console.log(`Pass Bi1:    ${passCountBi1}`);
      console.log(`Pass Bi2:    ${passCountBi2}`);
      console.log(`Pass C:      ${passCountC}`);
      console.log(`Pass D:      ${passCountD}`);
      console.log(`Pass Horner: ${passCountHorner}`);
      console.log(`Pass E:      ${passCountE}`);
      console.log(`TOTAL:       ${passCountA + passCountBi1 + passCountBi2 + passCountC + passCountD + passCountHorner + passCountE}`);
      console.log("============================\n");
    }
    this.device.queue.submit([commandEncoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    await this.multiResultXStagingBuffer.mapAsync(GPUMapMode.READ);
    await this.multiResultYStagingBuffer.mapAsync(GPUMapMode.READ);
    const xView = new Uint32Array(this.multiResultXStagingBuffer.getMappedRange()).slice();
    const yView = new Uint32Array(this.multiResultYStagingBuffer.getMappedRange()).slice();
    this.multiResultXStagingBuffer.unmap();
    this.multiResultYStagingBuffer.unmap();
    const results = [];
    for (let jobIdx = 0; jobIdx < jobs.length; jobIdx++) {
      const offset = jobIdx * LIMBS_PER_ELEMENT_256;
      results.push({
        x: limbs256ToBigint(xView.subarray(offset, offset + LIMBS_PER_ELEMENT_256)),
        y: limbs256ToBigint(yView.subarray(offset, offset + LIMBS_PER_ELEMENT_256))
      });
    }
    return results;
  }
  destroy() {
    this.batchFinalPointsXBuffer?.destroy();
    this.batchFinalPointsYBuffer?.destroy();
    this.batchFinalPointsZBuffer?.destroy();
  }
  packBatchInputs(scalars, points, batchOffset, currentBatchN) {
    for (let i = 0; i < currentBatchN; i++) {
      const sourceIndex = batchOffset + i;
      const targetOffset = i * LIMBS_PER_ELEMENT_256;
      writeBigint256ToLimbs(scalars[sourceIndex], this.kHost, targetOffset);
      writeBigint256ToLimbs(points[sourceIndex].x, this.pxHost, targetOffset);
      writeBigint256ToLimbs(points[sourceIndex].y, this.pyHost, targetOffset);
    }
  }
  ensureBatchFinalPointsCapacity(numBatches) {
    if (numBatches <= this.batchFinalPointsCapacity) {
      return;
    }
    this.batchFinalPointsXBuffer?.destroy();
    this.batchFinalPointsYBuffer?.destroy();
    this.batchFinalPointsZBuffer?.destroy();
    const batchFinalPointsSize = Math.max(numBatches * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    this.batchFinalPointsXBuffer = this.createBuffer(batchFinalPointsSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.batchFinalPointsYBuffer = this.createBuffer(batchFinalPointsSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.batchFinalPointsZBuffer = this.createBuffer(batchFinalPointsSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.bindGroupBatchFinalPoints = this.device.createBindGroup({
      layout: this.layoutBatchFinalPoints,
      entries: [
        { binding: 0, resource: { buffer: this.batchFinalPointsXBuffer } },
        { binding: 1, resource: { buffer: this.batchFinalPointsYBuffer } },
        { binding: 2, resource: { buffer: this.batchFinalPointsZBuffer } }
      ]
    });
    this.batchFinalPointsCapacity = numBatches;
  }
  ensureMultiResultCapacity(numJobs) {
    if (numJobs <= this.multiResultCapacity)
      return;
    this.multiResultXBuffer?.destroy();
    this.multiResultYBuffer?.destroy();
    this.multiResultXStagingBuffer?.destroy();
    this.multiResultYStagingBuffer?.destroy();
    const size = Math.max(numJobs * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    this.multiResultXBuffer = this.createBuffer(size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.multiResultYBuffer = this.createBuffer(size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    this.multiResultXStagingBuffer = this.createBuffer(size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    this.multiResultYStagingBuffer = this.createBuffer(size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    this.multiResultCapacity = numJobs;
  }
  clearReusableState(commandEncoder, numBatches) {
    const batchBytes = Math.max(numBatches * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    commandEncoder.clearBuffer(this.bXBuffer);
    commandEncoder.clearBuffer(this.bYBuffer);
    commandEncoder.clearBuffer(this.bZBuffer);
    commandEncoder.clearBuffer(this.fWindowsXBuffer);
    commandEncoder.clearBuffer(this.fWindowsYBuffer);
    commandEncoder.clearBuffer(this.fWindowsZBuffer);
    commandEncoder.clearBuffer(this.batchFinalPointsXBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.batchFinalPointsYBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.batchFinalPointsZBuffer, 0, batchBytes);
    commandEncoder.clearBuffer(this.finalPointXBuffer);
    commandEncoder.clearBuffer(this.finalPointYBuffer);
  }
  createBuffer(size, usage) {
    return this.device.createBuffer({ size, usage });
  }
  createUniformBufferWithData(values) {
    const buffer = this.device.createBuffer({
      size: values.length * 4,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true
    });
    new Uint32Array(buffer.getMappedRange()).set(values);
    buffer.unmap();
    return buffer;
  }
};

// dist/src/proof/webgpuMsmBatcher.js
var sharedDevicePromise;
async function getSharedDevice() {
  if (typeof navigator === "undefined" || navigator.gpu === void 0) {
    return null;
  }
  sharedDevicePromise ??= (async () => {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
      return null;
    return await adapter.requestDevice();
  })();
  return await sharedDevicePromise;
}
function isAffinePoint(point) {
  return point !== null && typeof point === "object" && typeof point.x === "bigint" && typeof point.y === "bigint";
}
function canBatchRequest(context) {
  return (context.curve === "pallas" || context.curve === "vesta") && Array.isArray(context.scalars) && Array.isArray(context.points) && context.scalars.length > 0 && context.points.length === context.scalars.length && context.points.every((point) => isAffinePoint(point));
}
function createWebGpuBatchedMsmRunner(options) {
  const bucketWidthBits = options?.bucketWidthBits ?? 8;
  const verbose = options?.verbose ?? false;
  let queue = [];
  let flushScheduled = false;
  async function fallbackRequest(request) {
    const fallback = request.context.cpuFallback;
    if (!fallback) {
      request.resolve(void 0);
      return;
    }
    try {
      request.resolve(await fallback());
    } catch (error) {
      request.reject(error);
    }
  }
  async function flush() {
    flushScheduled = false;
    const batch = queue;
    queue = [];
    const device = await getSharedDevice();
    if (!device) {
      await Promise.all(batch.map((request) => fallbackRequest(request)));
      return;
    }
    const pallasRequests = batch.filter((request) => request.context.curve === "pallas" && canBatchRequest(request.context));
    const vestaRequests = batch.filter((request) => request.context.curve === "vesta" && canBatchRequest(request.context));
    const fallbackRequests = batch.filter((request) => !((request.context.curve === "pallas" || request.context.curve === "vesta") && canBatchRequest(request.context)));
    await Promise.all(fallbackRequests.map((request) => fallbackRequest(request)));
    const runGroup = async (curve, requests) => {
      if (requests.length === 0)
        return;
      const jobs = requests.map((request) => ({
        label: request.context.metadata?.label?.toString() ?? request.context.msmKind,
        scalars: request.context.scalars,
        points: request.context.points
      }));
      if (verbose) {
        console.log(`[gpu-batch] curve=${curve} jobs=${jobs.length} sizes=${jobs.map((job) => job.scalars.length).join(",")}`);
      }
      try {
        const results = curve === "pallas" ? await createPippengerMSMPallasRunner(device, {
          bucketWidthBits
        }).runMany(jobs, { verbose: false }) : await createPippengerMSMVestaRunner(device, {
          bucketWidthBits
        }).runMany(jobs, { verbose: false });
        for (let i = 0; i < requests.length; i++) {
          requests[i].resolve(results[i]);
        }
      } catch (error) {
        await Promise.all(requests.map((request) => fallbackRequest(request)));
      }
    };
    await runGroup("pallas", pallasRequests);
    await runGroup("vesta", vestaRequests);
  }
  return (context) => new Promise((resolve, reject) => {
    queue.push({ context, resolve, reject });
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(() => {
        void flush();
      });
    }
  });
}

export {
  preloadEmbeddedO1jsCompileCache,
  createWebGpuBatchedMsmRunner
};

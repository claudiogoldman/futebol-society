// Shared helpers for normalizing Supabase responses.
// Introducing these helpers does not change any business rule.

export function unwrapSupabase({ data, error }) {
  if (error) {
    const normalized = new Error(error.message || 'Erro ao executar operação.');
    normalized.code = error.code || null;
    normalized.details = error.details || null;
    normalized.hint = error.hint || null;
    throw normalized;
  }

  return data;
}

export async function runSupabase(operation) {
  try {
    return unwrapSupabase(await operation());
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: {
        message: error?.message || 'Erro inesperado ao executar operação.',
        code: error?.code || null,
        details: error?.details || null,
      },
    };
  }
}

export async function runSupabaseOrThrow(operation) {
  return unwrapSupabase(await operation());
}

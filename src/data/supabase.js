import { createClient } from "@supabase/supabase-js";

// These are public (publishable) keys — safe to include in client code.
// RLS policies on the database ensure each user only sees their own data.
export const supabase = createClient(
  "https://uohzahtlldhzlunxpvtu.supabase.co",
  "sb_publishable_JO1CKpEx09fLmxW8DokIIQ_25IGFUFg"
);

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

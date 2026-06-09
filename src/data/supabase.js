import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://uohzahtlldhzlunxpvtu.supabase.co",
  "sb_publishable_JO1CKpEx09fLmxW8DokIIQ_25IGFUFg"
);

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error;
}

export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  return error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

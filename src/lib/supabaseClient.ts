import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_S_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_ANON_KEY || '';

let supabase: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Using fallback client.');
  console.warn('VITE_S_URL:', supabaseUrl ? 'set' : 'missing');
  console.warn('VITE_ANON_KEY:', supabaseAnonKey ? 'set' : 'missing');
  supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) console.error('Error signing in with Google:', error.message);
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error signing out:', error.message);
};

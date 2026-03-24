import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const messages = await supabase.from('chat_messages').select('*').limit(1);
  console.log('chat_messages columns:', messages.data ? Object.keys(messages.data[0] || {}) : messages.data);

  const convs = await supabase.from('conversations').select('*').limit(1);
  console.log('conversations error:', convs.error ? convs.error.message : 'No error, table exists');
}

run();

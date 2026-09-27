const supabaseClient = window.supabase.createClient(
	'https://aqatphjaqzdfwqshdmyk.supabase.co',
	'sb_publishable_PtadCdQVkS8z6Doc6JEzyQ_qxG3PzYm'
);

const supabasePublicClient = window.supabase.createClient(
	'https://aqatphjaqzdfwqshdmyk.supabase.co',
	'sb_publishable_PtadCdQVkS8z6Doc6JEzyQ_qxG3PzYm',
	{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);
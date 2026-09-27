import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

	try {
		const authorization = request.headers.get('Authorization');
		if (!authorization?.startsWith('Bearer ')) {
			return new Response(JSON.stringify({ error: 'Yetkisiz istek.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		const authClient = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_ANON_KEY')!,
			{ global: { headers: { Authorization: authorization } } }
		);
		const { data: { user }, error: userError } = await authClient.auth.getUser();
		const doctorEmail = Deno.env.get('DOCTOR_EMAIL');
		if (userError || !user || !doctorEmail || user.email?.trim().toLowerCase() !== doctorEmail.trim().toLowerCase()) {
			return new Response(JSON.stringify({ error: 'Yetkisiz istek.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		const { appointmentId, status } = await request.json();
		if (!appointmentId || !['confirmed', 'cancelled'].includes(status)) {
			return new Response(JSON.stringify({ error: 'Geçersiz istek.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
		const resendApiKey = Deno.env.get('RESEND_API_KEY');
		const emailFrom = Deno.env.get('EMAIL_FROM') || 'onboarding@resend.dev';
		if (!resendApiKey) throw new Error('RESEND_API_KEY secret eksik.');
		const { data: appointment, error: appointmentError } = await adminClient.from('appointments').select('name, email, appointment_date, appointment_time').eq('id', appointmentId).single();
		if (appointmentError || !appointment?.email) throw new Error('Randevu veya e-posta bulunamadı.');

		const isConfirmed = status === 'confirmed';
		const subject = isConfirmed ? 'Randevunuz onaylandı' : 'Randevunuz iptal edildi';
		const heading = isConfirmed ? 'Randevunuz Onaylandı' : 'Randevunuz İptal Edildi';
		const safeName = escapeHtml(appointment.name);
		const message = isConfirmed
			? `Sayın ${safeName},<br><br>Randevunuz onaylanmıştır.<br><strong>Tarih:</strong> ${appointment.appointment_date}<br><strong>Saat:</strong> ${appointment.appointment_time || '-'}<br><br>Sizi kliniğimizde görmekten memnuniyet duyacağız.`
			: `Sayın ${safeName},<br><br>Maalesef ${appointment.appointment_date} tarihindeki ${appointment.appointment_time || '-'} saatli randevunuz iptal edilmiştir.<br><br>Yeni bir randevu için lütfen bizimle iletişime geçin.`;

		const emailResponse = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: emailFrom,
				to: [appointment.email],
				subject,
				html: `<div style="font-family:Arial,sans-serif;line-height:1.7"><h2>${heading}</h2><p>${message}</p><p>Dr. Muhammed Koşan Kliniği</p></div>`
			})
		});
		if (!emailResponse.ok) {
			const resendError = await emailResponse.text();
			throw new Error(`Resend ${emailResponse.status}: ${resendError}`);
		}

		return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
	}
});

function escapeHtml(value: string) {
	return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
}
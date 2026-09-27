const loginPanel = document.querySelector('#login-panel');
const appointmentsPanel = document.querySelector('#appointments-panel');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const logoutButton = document.querySelector('#logout-button');
const appointmentsList = document.querySelector('#appointments-list');
const appointmentsMessage = document.querySelector('#appointments-message');
const availabilityForm = document.querySelector('#availability-form');
const availabilityCalendarInput = document.querySelector('#availability-calendar');
const availabilitySummary = document.querySelector('#availability-summary');
const availabilityError = document.querySelector('#availability-error');
const availableModeButton = document.querySelector('#available-mode');
const unavailableModeButton = document.querySelector('#unavailable-mode');
const emailJsServiceId = 'service_fony6f7';
const emailJsTemplateId = 'template_z8l5uyr';
const emailJsPublicKey = 'XoruBY5-c7cxulnQG';
let availabilityCalendar;
let availabilityEntries = [];
let availabilityMode = true;

emailjs.init({ publicKey: emailJsPublicKey });

loginForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	const formData = new FormData(loginForm);
	const { error } = await supabaseClient.auth.signInWithPassword({
		email: formData.get('email'),
		password: formData.get('password')
	});

	if (error) {
		loginError.hidden = false;
		loginError.textContent = 'Giriş bilgileri hatalı.';
		return;
	}

	loginError.hidden = true;
	showAppointments();
});

logoutButton.addEventListener('click', async () => {
	await supabaseClient.auth.signOut();
	showLogin();
});

availableModeButton.addEventListener('click', () => setAvailabilityMode(true));
unavailableModeButton.addEventListener('click', () => setAvailabilityMode(false));

function setAvailabilityMode(isAvailable) {
	availabilityMode = isAvailable;
	availableModeButton.classList.toggle('active-green', isAvailable);
	unavailableModeButton.classList.toggle('active-red', !isAvailable);
}

async function showAppointments() {
	loginPanel.hidden = true;
	appointmentsPanel.hidden = false;
	logoutButton.hidden = false;
	loadAvailability();
	loadAppointments();
}

async function loadAppointments() {
	const { data, error } = await supabaseClient.from('appointments').select('*').order('appointment_date', { ascending: true });

	if (error) {
		appointmentsMessage.textContent = 'Randevular yüklenemedi.';
		return;
	}

	appointmentsMessage.textContent = data.length ? '' : 'Henüz randevu yok.';
	appointmentsList.innerHTML = data.map((appointment) => `
		<tr>
			<td>${escapeHtml(appointment.name)}</td>
			<td>${escapeHtml(appointment.email || '-')}</td>
			<td>${escapeHtml(appointment.phone)}</td>
			<td>${escapeHtml(appointment.appointment_date)}</td>
			<td>${escapeHtml(appointment.appointment_time || '-')}</td>
			<td>${escapeHtml(appointment.message || '-')}</td>
			<td><select class="status-select" data-id="${appointment.id}" ${appointment.status_email_sent ? 'disabled' : ''}><option value="new" ${appointment.status === 'new' ? 'selected' : ''}>Yeni</option><option value="confirmed" ${appointment.status === 'confirmed' ? 'selected' : ''}>Onaylandı</option><option value="cancelled" ${appointment.status === 'cancelled' ? 'selected' : ''}>İptal edildi</option></select>${appointment.status_email_sent ? '<small> E-posta gönderildi</small>' : ''}</td>
			<td><button class="delete-appointment" type="button" data-id="${appointment.id}">Sil</button></td>
		</tr>`).join('');
	appointmentsList.querySelectorAll('.status-select').forEach((select) => {
		select.addEventListener('change', updateStatus);
	});
	appointmentsList.querySelectorAll('.delete-appointment').forEach((button) => {
		button.addEventListener('click', deleteAppointment);
	});
}

async function deleteAppointment(event) {
	const appointmentId = event.currentTarget.dataset.id;
	if (!confirm('Bu randevuyu silmek istediğinize emin misiniz?')) return;

	const { error } = await supabaseClient.from('appointments').delete().eq('id', appointmentId);
	if (error) {
		alert('Randevu silinemedi.');
		return;
	}

	await loadAppointments();
}

setInterval(() => {
	if (!appointmentsPanel.hidden) {
		loadAppointments();
		loadAvailability();
	}
}, 5000);

document.addEventListener('visibilitychange', () => {
	if (!document.hidden && !appointmentsPanel.hidden) {
		loadAppointments();
		loadAvailability();
	}
});

availabilityForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	if (!availabilityCalendar) {
		availabilityError.hidden = false;
		availabilityError.textContent = 'Takvim henüz hazır değil. Lütfen tekrar deneyin.';
		return;
	}
	const selectedDates = availabilityCalendar.selectedDates.map((date) => availabilityCalendar.formatDate(date, 'Y-m-d'));
	if (!selectedDates.length) {
		availabilityError.hidden = false;
		availabilityError.textContent = 'Lütfen takvimden en az bir tarih seçin.';
		return;
	}

	const { error } = await supabaseClient.from('doctor_availability').upsert(selectedDates.map((date) => ({
		available_date: date,
		is_available: availabilityMode
	})), {
		onConflict: 'available_date'
	});

	if (error) {
		availabilityError.hidden = false;
		availabilityError.textContent = 'Müsaitlik durumu kaydedilemedi.';
		return;
	}

	availabilityError.hidden = true;
	availabilityCalendar.clear();
	loadAvailability();
});

async function loadAvailability() {
	initializeAvailabilityCalendar();
	const { data, error } = await supabaseClient.from('doctor_availability').select('*').order('available_date', { ascending: true });
	if (error) {
		availabilityError.hidden = false;
		availabilityError.textContent = 'Müsaitlik takvimi yüklenemedi.';
		return;
	}
	availabilityEntries = data;
	availabilityCalendar.redraw();

	const availableDates = data.filter((entry) => entry.is_available).map((entry) => entry.available_date);
	const unavailableDates = data.filter((entry) => !entry.is_available).map((entry) => entry.available_date);
	availabilitySummary.innerHTML = `
		<div class="availability-group available"><h3>Yeşil günler - Müsait</h3><ul class="availability-dates">${renderDates(availableDates, 'Müsait gün eklenmedi.')}</ul></div>
		<div class="availability-group unavailable"><h3>Kırmızı günler - Kapalı</h3><ul class="availability-dates">${renderDates(unavailableDates, 'Kapalı gün eklenmedi.')}</ul></div>`;
}

function initializeAvailabilityCalendar() {
	if (availabilityCalendar) return;
	availabilityCalendar = flatpickr(availabilityCalendarInput, {
		mode: 'multiple',
		locale: flatpickr.l10ns.tr,
		dateFormat: 'Y-m-d',
		minDate: 'today',
		onDayCreate: (_selectedDates, _dateString, instance, dayElement) => {
			const date = instance.formatDate(dayElement.dateObj, 'Y-m-d');
			const entry = availabilityEntries.find((item) => item.available_date === date);
			if (entry?.is_available) dayElement.classList.add('doctor-available');
			if (entry && !entry.is_available) dayElement.classList.add('doctor-unavailable');
		}
	});
}

function renderDates(dates, emptyMessage) {
	return dates.length ? dates.map((date) => `<li>${formatDate(date)}</li>`).join('') : `<li>${emptyMessage}</li>`;
}

function formatDate(date) {
	return new Intl.DateTimeFormat('tr-TR').format(new Date(`${date}T00:00:00`));
}

async function updateStatus(event) {
	const status = event.target.value;
	const appointmentId = event.target.dataset.id;
	const { error } = await supabaseClient.from('appointments').update({ status }).eq('id', appointmentId);
	if (error) {
		alert('Randevu durumu güncellenemedi.');
		return;
	}

	if (status === 'confirmed' || status === 'cancelled') {
		const { data: appointment, error: appointmentError } = await supabaseClient.from('appointments').select('name, email, appointment_date, appointment_time').eq('id', appointmentId).single();
		if (appointmentError || !appointment?.email) {
			alert('Durum kaydedildi ancak hasta e-postası bulunamadı.');
			return;
		}
		const { data: claimed, error: claimError } = await supabaseClient.rpc('claim_appointment_status_email', { appointment_id: appointmentId });
		if (claimError || !claimed) {
			await loadAppointments();
			return;
		}

		const statusMessage = status === 'confirmed'
			? 'Randevunuz onaylanmıştır.'
			: 'Maalesef randevunuz iptal edilmiştir.';
		const { error: emailError } = await emailjs.send(emailJsServiceId, emailJsTemplateId, {
			to_email: appointment.email,
			patient_name: appointment.name,
			appointment_date: appointment.appointment_date,
			appointment_time: appointment.appointment_time || '-',
			status_message: statusMessage,
			reply_to: 'muhammedkoshan29@gmail.com'
		});

		if (emailError) {
			await supabaseClient.from('appointments').update({ status_email_sent: false }).eq('id', appointmentId);
			alert(`Durum kaydedildi ancak e-posta gönderilemedi.\n\nHata: ${emailError.text || emailError.message || 'Bilinmeyen hata.'}`);
		} else {
			await loadAppointments();
		}
	}
}

function showLogin() {
	loginPanel.hidden = false;
	appointmentsPanel.hidden = true;
	logoutButton.hidden = true;
}

function escapeHtml(value) {
	return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

supabaseClient.auth.getSession().then(({ data }) => {
	if (data.session) showAppointments();
});
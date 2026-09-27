const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

menuToggle.addEventListener('click', () => {
	const isOpen = mainNav.classList.toggle('open');
	menuToggle.setAttribute('aria-expanded', String(isOpen));
});

mainNav.querySelectorAll('a').forEach((link) => {
	link.addEventListener('click', () => {
		mainNav.classList.remove('open');
		menuToggle.setAttribute('aria-expanded', 'false');
	});
});

const observer = new IntersectionObserver((entries) => {
	entries.forEach((entry) => {
		if (entry.isIntersecting) {
			entry.target.style.animationPlayState = 'running';
			observer.unobserve(entry.target);
		}
	});
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => {
	element.style.animationPlayState = 'paused';
	observer.observe(element);
});

const appointmentForm = document.querySelector('#randevu-formu');
const appointmentDateInput = document.querySelector('#appointment-date');
const appointmentTimeInput = document.querySelector('select[name="time"]');
const dateHelp = document.querySelector('#date-help');
let availableDates = new Set();

const availabilityReady = loadAvailableDates();

appointmentDateInput.addEventListener('change', () => {
	const isUnavailable = !availableDates.has(appointmentDateInput.value);
	appointmentDateInput.setCustomValidity(isUnavailable ? 'Bu tarih müsait değil.' : '');
	dateHelp.textContent = isUnavailable ? 'Lütfen doktorun belirlediği müsait günlerden birini seçin.' : 'Müsait bir tarih seçin.';
	loadBookedTimes(appointmentDateInput.value);
});

async function loadBookedTimes(date) {
	appointmentTimeInput.querySelectorAll('option:not(:first-child)').forEach((option) => {
		option.disabled = false;
		option.textContent = option.value;
	});
	appointmentTimeInput.value = '';
	if (!date) return;

	const { data, error } = await supabasePublicClient.rpc('get_booked_times', { requested_date: date });
	if (error) return;
	const bookedTimes = new Set((data || []).map((entry) => entry.appointment_time.slice(0, 5)));
	appointmentTimeInput.querySelectorAll('option:not(:first-child)').forEach((option) => {
		if (bookedTimes.has(option.value)) {
			option.disabled = true;
			option.textContent = `${option.value} (Dolu)`;
		}
	});
}

async function loadAvailableDates() {
	const { data } = await supabasePublicClient.from('doctor_availability').select('available_date, is_available').order('available_date', { ascending: true });
	const today = new Date().toISOString().split('T')[0];
	availableDates = new Set((data || []).filter((entry) => entry.is_available && entry.available_date >= today).map((entry) => entry.available_date));
	flatpickr(appointmentDateInput, {
		locale: flatpickr.l10ns.tr,
		dateFormat: 'Y-m-d',
		altInput: true,
		altFormat: 'd.m.Y',
		allowInput: false,
		enable: [...availableDates],
		defaultDate: availableDates.size ? [...availableDates][0] : undefined,
		onChange: () => appointmentDateInput.dispatchEvent(new Event('change'))
	});
	if (!availableDates.size) {
		appointmentDateInput.disabled = true;
		dateHelp.textContent = 'Henüz müsait tarih belirlenmedi.';
	}
}

appointmentForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	await availabilityReady;
	const submitButton = appointmentForm.querySelector('button[type="submit"]');
	const formData = new FormData(appointmentForm);
	if (formData.get('company')) return;
	const fullName = formData.get('name').trim().replace(/\s+/g, ' ');
	const phone = formData.get('phone').replace(/\s/g, '');
	const email = formData.get('email').trim();
	const message = formData.get('message').trim();
	const phonePattern = /^(?:90\d{10}|0\d{10}|[1-9]\d{9})$/;
	const namePattern = /^[A-Za-zÇĞİÖŞÜçğıöşü]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü]+)+$/;

	if (!namePattern.test(fullName)) {
		alert('Lütfen adınızı ve soyadınızı eksiksiz yazın.');
		return;
	}

	if (email.length > 254 || message.length > 1000) {
		alert('Lütfen verileri kısaltıp tekrar deneyin.');
		return;
	}

	if (!phonePattern.test(phone)) {
		alert('Lütfen 10, 11 veya 12 haneli geçerli bir telefon numarası yazın.');
		return;
	}

	if (!availableDates.has(formData.get('date'))) {
		alert('Lütfen doktorun belirlediği müsait günlerden birini seçin.');
		return;
	}

	const { data: slotAvailable, error: slotError } = await supabasePublicClient.rpc('is_appointment_slot_available', {
		requested_date: formData.get('date'),
		requested_time: formData.get('time')
	});
	if (slotError || !slotAvailable) {
		await loadBookedTimes(formData.get('date'));
		alert('Bu saat artık dolu. Lütfen başka bir saat seçin.');
		return;
	}

	submitButton.disabled = true;
	submitButton.textContent = 'Gönderiliyor...';

	const { error } = await supabasePublicClient.from('appointments').insert({
		name: fullName,
		email,
		phone,
		appointment_date: formData.get('date'),
		appointment_time: formData.get('time'),
		message
	});

	if (error) {
		submitButton.disabled = false;
		submitButton.innerHTML = 'Talep gönder <span>↗</span>';
		alert('Randevu gönderilemedi. Lütfen tekrar deneyin.');
		return;
	}

	appointmentForm.innerHTML = '<p class="form-success">Randevu talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.</p>';
});

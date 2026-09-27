const googleAnalyticsId = 'G-KCW4Z2E5XH';
window.dataLayer = window.dataLayer || [];
window.gtag = function () {
	window.dataLayer.push(arguments);
};
window.gtag('js', new Date());
window.gtag('config', googleAnalyticsId);

const googleAnalyticsScript = document.createElement('script');
googleAnalyticsScript.async = true;
googleAnalyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
document.head.appendChild(googleAnalyticsScript);

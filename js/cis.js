document.addEventListener('DOMContentLoaded', function() {
    // Список кодов стран СНГ (ISO 3166-1 alpha-2)
    const cisCountries = ['RU', 'UA', 'BY', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'AM', 'AZ', 'MD'];

    // Функция для получения геолокации
    function checkGeoLocation() {
        fetch('https://ipapi.co/json/')
            .then(response => response.json())
            .then(data => {
                const countryCode = data.country_code;
                if (cisCountries.includes(countryCode)) {
                    showNotification();
                }
            })
            .catch(error => {
                console.error('Ошибка при получении геолокации:', error);
            });
    }

    // Функция для отображения уведомления
    function showNotification() {
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.top = '50%';
        notification.style.left = '50%';
        notification.style.transform = 'translate(-50%, -50%)';
        notification.style.backgroundColor = '#f44336';
        notification.style.color = 'white';
        notification.style.padding = '20px';
        notification.style.borderRadius = '5px';
        notification.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        notification.style.zIndex = '1000';
        notification.style.textAlign = 'center';
        notification.style.fontSize = '18px';
        notification.style.maxWidth = '400px';
        notification.innerHTML = 'Подключение к сайту не работает в вашей стране.<br>Включите VPN и обновите страницу (CTRL + F5)';
        document.body.appendChild(notification);
    }

    // Запуск проверки геолокации
    checkGeoLocation();
});

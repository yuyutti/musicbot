const ctx = document.getElementById('myChart').getContext('2d');

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

async function fetchData() {
    try {
        const response = await fetch('/data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function drawChart() {
    const useData = await fetchData();

    const guildIds = Object.keys(useData);
    const weekNumbers = Object.keys(useData[guildIds[0]].data);

    const datasets = guildIds.map(guildId => {
        const guildName = useData[guildId].name;
        const data = weekNumbers.map(weekNumber => useData[guildId].data[weekNumber] || 0);
        return {
            label: `${guildName}`,
            data: data,
            backgroundColor: getRandomColor(),
            borderColor: 'rgba(0, 0, 0, 0.5)',
            borderWidth: 1
        };
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekNumbers,
            datasets: datasets
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

drawChart();
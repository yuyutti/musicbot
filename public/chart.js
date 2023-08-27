const ctx = document.getElementById('myChart').getContext('2d');

let currentWeekIndex = 0;
let weekNumbers;
let useData;
let myChart;
let flag = true

async function fetchData() {
    try {
        const response = await fetch('/data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function formatWeekRange(weekNumber) {
    const year = weekNumber.substring(0, 4);
    const week = weekNumber.substring(5);

    const startDate = new Date(year, 0, 1);
    startDate.setDate(startDate.getDate() + (parseInt(week) - 1) * 7);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
    const formattedStartDate = startDate.toLocaleDateString('ja-JP', options);
    const formattedEndDate = endDate.toLocaleDateString('ja-JP', options);

    return `${formattedStartDate} ～ ${formattedEndDate}`;
}

async function getYearWeek(date) {
    const timeZoneOffset = 9 * 60;
    const adjustedDate = new Date(date.getTime() + timeZoneOffset * 60 * 1000);

    const year = adjustedDate.getFullYear();
    const dayOfWeek = adjustedDate.getDay();
    const daysToAdd = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const dateForCalculation = new Date(adjustedDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const week = String(Math.ceil(((dateForCalculation - new Date(year, 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0');
    return `${year}-${week}`;
}

async function drawTable(guildIds, useData, currentWeekNumber) {
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = '';

    guildIds.sort((a, b) => {
        const dataA = useData[a].data[currentWeekNumber] || 0;
        const dataB = useData[b].data[currentWeekNumber] || 0;
        return dataB - dataA;
    });

    guildIds.forEach(guildId => {
        const guildName = useData[guildId].name;
        const data = useData[guildId].data[currentWeekNumber] || 0;

        const row = document.createElement('tr');
        const guildNameCell = document.createElement('td');
        const dataCell = document.createElement('td');

        guildNameCell.textContent = guildName;
        dataCell.textContent = data;

        row.appendChild(guildNameCell);
        row.appendChild(dataCell);

        tableBody.appendChild(row);
    });
}

async function drawChart() {
    if (myChart) myChart.destroy();

    const useData = await fetchData();

    const guildIds = Object.keys(useData);
    weekNumbers = Object.keys(useData[guildIds[0]].data);

    console.log(weekNumbers)
    const now = new Date();
    const yearWeek = await getYearWeek(now);

    if(flag){
        if(weekNumbers.includes(yearWeek)){
            currentWeekIndex = weekNumbers.indexOf(yearWeek)
        }
    }

    const currentWeekNumber = weekNumbers[currentWeekIndex];
    const datasets = guildIds.map(guildId => {
        const guildName = useData[guildId].name;
        const data = weekNumbers.map(() => useData[guildId].data[currentWeekNumber] || 0);
        const isAllZeros = data.every(value => value === 0);
        return {
            label: `${guildName}`,
            data: data,
            backgroundColor: getRandomColor(),
            borderColor: 'rgba(0, 0, 0, 0.5)',
            borderWidth: 1,
            hidden: isAllZeros
        };
    });

    datasets.sort((a, b) => {
        const sumA = a.data.reduce((sum, value) => sum + value, 0);
        const sumB = b.data.reduce((sum, value) => sum + value, 0);
        return sumB - sumA;
    });

    drawTable(guildIds, useData, currentWeekNumber);

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: " ",
            datasets: datasets
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `${formatWeekRange(currentWeekNumber)}`
                }
            }
        }
    });
}

document.getElementById('prevWeekBtn').addEventListener('click', () => {
    if (currentWeekIndex > 0) {
        flag = false
        currentWeekIndex--;
        drawChart();
    }
});

document.getElementById('nextWeekBtn').addEventListener('click', () => {
    if (currentWeekIndex < weekNumbers.length - 1) {
        flag = false
        currentWeekIndex++;
        drawChart();
    }
});

drawChart();
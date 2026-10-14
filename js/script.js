// set margin
const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const path = './data/weather.csv'

// dataset col names
const COLS = ["station", "state", "latitude", "longitude", "elevation", "date",
  "TMIN", "TMAX", "TAVG", "AWND", "WDF5", "WSF5", "SNOW", "SNWD", "PRCP"]

// Dropdown variables
let allData = []
let byState = new Map();   // state -> [rows]
let byStation = new Map(); // state -> Map(station -> [rows])
let defaultDay = 109

// some values are empty and need to checked before conversion
const nothingOrNum = val => (val == '' || val == null) ? null : +val

//state and station dropdown filter
const filters = { state: 'All', variable: 'TAVG', days: [1, 365] }


const variableLabels = {
  TAVG: { label: 'Average Temperature (°F)' },
  TMIN: { label: 'Minimum Temperature (°F)' },
  TMAX: { label: 'Maximum Temperature (°F)' },
  PRCP: { label: 'Precipitation (inches)' },
  SNOW: { label: 'Snowfall (inches)' },
  AWND: { label: 'Average Wind Speed (mph)' }
};



// Transitions and legend variables
const transitionTime = 1000; // 1000ms = 1 second
let legendSize = 10  // Size of the legend squares


// Create SVG
const svg = d3.select('#vis')
  .append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`);

// add a hover layer
const hoverLayer = svg.append('g').attr('class', 'hover-layer')

// some visualizations already designated
svg.append('g').attr('class', 'vis-line-plot')
svg.append('g').attr('class', 'vis-pictogram')
svg.append('g').attr('class', 'vis-country-map')


// Initialization
function init() {
  d3.csv(path, d => {
    //console.log("Raw CSV row:", d) // debugging

    parsed_date = parseDateGetDayOfYear(d.date)
    const row = {
      station: d.station,
      state: d.state,
      latitude: nothingOrNum(d.latitude),
      longitude: nothingOrNum(d.longitude),
      elevation: nothingOrNum(d.elevation),
      date: parsed_date.date,
      dayOfYear: parsed_date.dayOfYear,
      TMIN: nothingOrNum(d.TMIN),
      TMAX: nothingOrNum(d.TMAX),
      TAVG: nothingOrNum(d.TAVG),
      AWND: nothingOrNum(d.AWND),
      WDF5: nothingOrNum(d.WDF5),
      WSF5: nothingOrNum(d.WSF5),
      SNOW: nothingOrNum(d.SNOW),
      SNWD: nothingOrNum(d.SNWD),
      PRCP: nothingOrNum(d.PRCP),
    }

    row.weatherType = weatherClassifier(row)
    return row
  })

    .then(data => {
      //console.log(data) // Check structure
      //console.log("Total rows:", data.length)
      //console.log("First row:", data[0])
      //console.log("Columns:", data.columns)

      allData = data // Save processed data

      buildGroupings() // group by statr and stations
      setupSelector()
      updateVis()

      // can change or remove
      //updateAxes()
      //updateVis()
      //addLegend()

    })
    .catch(error => console.error('Error loading data:', error));
}

window.addEventListener('load', init);


// Data Helpers

// make date readable, and get day within 365 days
// example "20170312" -> { date: Date(2017, 2, 12), dayOfYear: 71 }
// used for
function parseDateGetDayOfYear(raw_date) {
  const s = String(raw_date)
  const parsed_date = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))
  const curr_year = new Date(parsed_date.getFullYear(), 0, 0)
  const dayToMiliSec = 1000 * 60 * 60 * 24
  const doy = Math.floor((parsed_date - curr_year) / dayToMiliSec)
  return { date: parsed_date, dayOfYear: doy }
}

const formatDay = (day) => {
  // used for slider to know what day you are sliding to.
  const date = new Date(2017, 0, 1) // first day of the yr
  date.setDate(date.getDate() + day - 1) // make jan 1 0th index

  return d3.timeFormat("%B %-d")(date) // turn into string
}

// get weather classification
function weatherClassifier(d) {
  if ((d.SNOW != null && d.SNOW > 0) || (d.SNWD != null && d.SNWD > 0)) return 'snowy';
  if (d.PRCP != null && d.PRCP > 0 &&
    ((d.SNOW == null || d.SNOW === 0) && (d.SNWD == null || d.SNWD === 0))) return 'rainy';
  if ((d.WSF5 != null && d.WSF5 > 0) || (d.AWND != null && d.AWND > 0)) return 'windy';
  return 'clear'
}

function weatherIcon(weatherCase) {
  // icons later, colors for now
  switch (weatherCase) {
    case 'snowy': return '#4fc3f7';
    case 'rainy': return '#1565c0';
    case 'windy': return '#90a4ae';
    case 'clear': return '#e5ff00';
    default: return '#e5ff00';
  }
}

// Function(s) to group by state and by station
function buildGroupings() {
  byState.clear()
  byStation.clear()

  // for each row, if there is no state label yet make it
  // group each station under the state via mapping, also make label if doesn't exist yet
  for (const ro of allData) {
    if (!byState.has(ro.state)) byState.set(ro.state, []);
    byState.get(ro.state).push(ro)

    if (!byStation.has(ro.state)) byStation.set(ro.state, new Map());
    const stationMap = byStation.get(ro.state);
    if (!stationMap.has(ro.station)) stationMap.set(ro.station, []);
    stationMap.get(ro.station).push(ro)
  }
}

// shows data that fits the dropdown filters (might change to a check box so multiple states could be seen?)
function selectASection() {
  const pool = filters.state === 'All' ? allData : (byState.get(filters.state) || []);
  return pool.filter(d => (filters.station === 'All' || d.station === filters.station) &&
    d.dayOfYear >= filters.days[0] && d.dayOfYear <= filters.days[1]
  )
}

// // Makes sliders and dropdowns clickable
// function setupSelector() {
//   // Handles UI changes (sliders, dropdowns)
//   //console.log("Rows loaded:", allData.length)
//   //console.log("States found:", Array.from(byState.keys()))

//   let slider = d3
//     .sliderHorizontal()
//     .min(1)
//     .max(365)
//     .step(1)
//     .width((width - 100)) // helps center it
//     .displayValue(true)
//     .tickValues([1, 60, 121, 182, 244, 305, 365])
//     .tickFormat(formatDay)
//     .default(defaultDay)
//     .on('onchange', (val) => {
//       defaultDay = +val
//       filters.days = [defaultDay, defaultDay] /***/

//       console.log("Numerical day:", defaultDay, "Calendar day:", formatDay(defaultDay))
//       //updateVis() // Refresh the chart 
//     })

//   d3.select('#dateSlider').selectAll('svg').remove()

//   d3.select('#dateSlider')
//     .append('svg')
//     .attr('width', (width - 40)) // helps center it
//     .attr('height', 100)
//     .append('g')
//     .attr('transform', 'translate(30,30)')
//     .call(slider)

//   // show states in dropdown (works now)
//   const states = ['All', ...Array.from(byState.keys()).sort()]
//   d3.selectAll('#stateSelection')
//     .selectAll('option')
//     .data(states)
//     .join('option')
//     .attr("value", d => d)
//     .text(d => d === 'All' ? 'All States' : d) // Displayed text

//   // when changing the states need to refresh the dropdown for stations
//   refreshStationDropdown()


//   // select all dropdown buttons
//   d3.select('#stateSelection').on('change', function () {
//     filters.state = this.value
//     filters.station = 'All' // reset station when state changes
//     refreshStationDropdown()
//     //updateVis() // (empty, not used)
//   })

//   d3.select('#stationSelection').on('change', function () {
//     filters.station = this.value
//     //updateVis() //(not used)
//   })
// }


function setupSelector() {
  // Create date slider
  let slider = d3
    .sliderHorizontal()
    .min(1)
    .max(365)
    .step(1)
    .width(width - 100)
    .displayValue(true)
    .tickValues([1, 60, 121, 182, 244, 305, 365])
    .tickFormat(formatDay)
    .default(defaultDay)
    .on('onchange', (val) => {
      defaultDay = +val;

      

      console.log(
        "Numerical day:", defaultDay,
        "Calendar day:", formatDay(defaultDay)
      );

      updateVis();
    });

  // Remove any existing slider
  d3.select('#dateSlider')
    .selectAll('svg')
    .remove();

  // Display the slider
  d3.select('#dateSlider')
    .append('svg')
    .attr('width', width - 40)
    .attr('height', 100)
    .append('g')
    .attr('transform', 'translate(30,30)')
    .call(slider);

  // Variable dropdown
  d3.select('#variableSelection')
    .on('change', function () {
      filters.variable = this.value;
      updateVis();
    });
}


function refreshStationDropdown() {
  let stations
  if (filters.state === 'All') stations = Array.from(new Set(allData.map(d => d.station))).sort()
  else {
    // filter by stations in which are mapped to a state, empty if no mapping
    const stationMap = byStation.get(filters.state)
    stations = stationMap ? Array.from(stationMap.keys()).sort() : []
  }
  d3.selectAll('#stationSelection')
    .selectAll('option')
    .data(['All', ...stations])
    .join('option')
    .attr("value", d => d)
    .text(d => d === 'All' ? 'All Stations' : d) // Displayed text

  // reset if new state is chosen to 'all'
  d3.select('#stationSelection').property('value', 'All')
}

// Potential Functions to use

function updateAxes(xScale, yScale) {
  const plot = svg.select('.vis-line-plot');

  // Create or update the x-axis
  plot.selectAll('.x-axis')
    .data([null])
    .join('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height})`)
    .call(
      d3.axisBottom(xScale)
        .ticks(d3.timeMonth.every(2))
        .tickFormat(d3.timeFormat('%b'))
    );

  // Create or update the y-axis
  plot.selectAll('.y-axis')
    .data([null])
    .join('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale));

  // X-axis label
  plot.selectAll('.x-label')
    .data([null])
    .join('text')
    .attr('class', 'axis-label x-label')
    .attr('x', width / 2)
    .attr('y', height + 45)
    .attr('text-anchor', 'middle')
    .text('Date in 2017');

  // Y-axis label
  plot.selectAll('.y-label')
    .data([null])
    .join('text')
    .attr('class', 'axis-label y-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -65)
    .attr('text-anchor', 'middle')
    .text(variableLabels[filters.variable].label);
}

function updateVis() {
  const plot = svg.select('.vis-line-plot');

  // Group available measurements by day of the year
  const dailyData = d3.rollups(
    allData.filter(d =>
      d[filters.variable] != null &&
      Number.isFinite(d[filters.variable])
    ),
    rows => ({
      date: rows[0].date,
      value: d3.mean(rows, d => d[filters.variable])
    }),
    d => d.dayOfYear
  )
    .map(([day, result]) => ({
      dayOfYear: day,
      date: result.date,
      value: result.value
    }))
    .sort((a, b) => a.dayOfYear - b.dayOfYear);

  // Stop if there is no data for the selected variable
  if (dailyData.length === 0) {
    plot.selectAll('.temperature-line').remove();
    plot.selectAll('.no-data').remove();

    plot.append('text')
      .attr('class', 'no-data')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .text('No data available for this variable');

    return;
  }

  plot.selectAll('.no-data').remove();

  // X-axis: calendar dates
  const xScale = d3.scaleTime()
    .domain([new Date(2017, 0, 1), new Date(2017, 11, 31)])
    .range([0, width]);

  // Y-axis: selected weather measurement
  let minValue = d3.min(dailyData, d => d.value);
  let maxValue = d3.max(dailyData, d => d.value);

  // Add space around the data, including when all values are equal
  if (minValue === maxValue) {
    minValue -= 1;
    maxValue += 1;
  } else {
    const padding = (maxValue - minValue) * 0.05;
    minValue -= padding;
    maxValue += padding;
  }

  const yScale = d3.scaleLinear()
    .domain([minValue, maxValue])
    .nice()
    .range([height, 0]);

  // Draw or update the axes
  updateAxes(xScale, yScale);

  // Create the line generator
  const line = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.value));

  // Draw or update the line
  plot.selectAll('.temperature-line')
    .data([dailyData])
    .join('path')
    .attr('class', 'temperature-line')
    .attr('fill', 'none')
    .attr('stroke', '#2878b5')
    .attr('stroke-width', 2)
    .attr('d', line);


  // Find the data for the selected date
  const selectedPoint = dailyData.find(
    d => d.dayOfYear === defaultDay
  );

  // Draw a vertical line at the selected date
  plot.selectAll('.selected-day-line')
    .data(selectedPoint ? [selectedPoint] : [])
    .join('line')
    .attr('class', 'selected-day-line')
    .attr('x1', d => xScale(d.date))
    .attr('x2', d => xScale(d.date))
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', '#e76f51')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5');

  // Highlight the selected point on the graph
  plot.selectAll('.selected-day-point')
    .data(selectedPoint ? [selectedPoint] : [])
    .join('circle')
    .attr('class', 'selected-day-point')
    .attr('cx', d => xScale(d.date))
    .attr('cy', d => yScale(d.value))
    .attr('r', 6)
    .attr('fill', '#e76f51')
    .attr('stroke', 'white')
    .attr('stroke-width', 2);



    
  // Add hover points to the line graph
  plot.selectAll('.hover-point')
    .data(dailyData)
    .join('circle')
    .attr('class', 'hover-point')
    .attr('cx', d => xScale(d.date))
    .attr('cy', d => yScale(d.value))
    .attr('r', 8)
    .style('fill', 'transparent')
    .on('mouseover', function(event, d) {
      const dayRows = allData.filter(
        row => row.dayOfYear === d.dayOfYear
      );

      const title = d3.timeFormat('%B %d, %Y')(d.date);

      let html = hoverTemperature(dayRows, title);

      html += `<br/>${variableLabels[filters.variable].label}: ${d.value.toFixed(2)}`;

      const precipitation = d3.mean(
        dayRows,
        row => row.PRCP
      );

      html += `<br/>Precipitation: ${
        precipitation == null
          ? 'N/A'
          : precipitation.toFixed(2) + ' inches'
      }`;

      showTooltip(event, html);

      d3.select(this)
        .style('stroke', 'black')
        .style('stroke-width', '2px');
    })
    .on('mousemove', function(event) {
      d3.select('#tooltip')
        .style('left', (event.pageX + 20) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
      hideTooltip();

      d3.select(this)
        .style('stroke', 'none')
        .style('stroke-width', '0px');
    });

}




function addLegend() {
  // Adds a legend so users can decode colors
}

function showTooltip(event, html) {
  d3.select('#tooltip')
    .style('display', 'block')
    .html(html)
    .style('left', (event.pageX + 20) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}

function hideTooltip() {
  d3.select('#tooltip')
    .style('display', 'none');
}

function hoverLocation(rows, title) {
  // shows: lat / long / elev
}

function hoverTemperature(rows, title) {
  const avgTemp = d3.mean(rows, d => d.TAVG);
  const minTemp = d3.mean(rows, d => d.TMIN);
  const maxTemp = d3.mean(rows, d => d.TMAX);

  return `
    <strong>${title}</strong><br/>
    Average Temperature: ${avgTemp == null ? 'N/A' : avgTemp.toFixed(2) + ' °F'}<br/>
    Minimum Temperature: ${minTemp == null ? 'N/A' : minTemp.toFixed(2) + ' °F'}<br/>
    Maximum Temperature: ${maxTemp == null ? 'N/A' : maxTemp.toFixed(2) + ' °F'}
  `;
}

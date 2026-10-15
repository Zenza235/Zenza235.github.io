// set margin
const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const path = './data/weather.csv'
const mapPath = 'https://d3js.org/us-10m.v2.json';

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
const filters = { state: 'All', station: 'All', days: [1, 365] }

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

// Create US map
const us = d3.json(mapPath);
const mapData = topojson.feature(us, us.objects.states).features;
const pathGen = d3.geoPath();

svg.append('g')
  .attr('class', 'vis-country-map')
  .selectAll('path')
  .data(mapData)
  .enter()
  .append('path')
  .attr('d', pathGen)

// Initialization
function init() {

  d3.csv(path, d => {
    // console.log("Raw CSV row:", d) // debugging
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

      buildGroupings() // group by state and stations
      setupSelector()
      updateVis()
      // can change or remove
      //updateAxes()
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

// Makes sliders and dropdowns clickable
function setupSelector() {
  // Handles UI changes (sliders, dropdowns)
  //console.log("Rows loaded:", allData.length)
  //console.log("States found:", Array.from(byState.keys()))

  let slider = d3
    .sliderHorizontal()
    .min(1)
    .max(365)
    .step(1)
    .width((width - 100)) // helps center it
    .displayValue(true)
    .tickValues([1, 60, 121, 182, 244, 305, 365])
    .tickFormat(formatDay)
    .default(defaultDay)
    .on('onchange', (val) => {
      defaultDay = +val
      filters.days = [defaultDay, defaultDay] /***/

      console.log("Numerical day:", defaultDay, "Calendar day:", formatDay(defaultDay))
      updateVis() // Refresh the chart
    })

  d3.select('#dateSlider').selectAll('svg').remove()

  d3.select('#dateSlider')
    .append('svg')
    .attr('width', (width - 40)) // helps center it
    .attr('height', 100)
    .append('g')
    .attr('transform', 'translate(30,30)')
    .call(slider)

  // show states in dropdown (works now)
  const states = ['All', ...Array.from(byState.keys()).sort()]
  d3.selectAll('#stateSelection')
    .selectAll('option')
    .data(states)
    .join('option')
    .attr("value", d => d)
    .text(d => d === 'All' ? 'All States' : d) // Displayed text

  // when changing the states need to refresh the dropdown for stations
  refreshStationDropdown()


  // select all dropdown buttons
  d3.select('#stateSelection').on('change', function () {
    filters.state = this.value
    filters.station = 'All' // reset station when state changes
    refreshStationDropdown()
    //updateVis() // (empty, not used)
  })

  d3.select('#stationSelection').on('change', function () {
    filters.station = this.value
    //updateVis() //(not used)
  })
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


// Update map viz w/ data
function updateVis() {
  let currentData = allData.filter(d => d.dayOfYear === defaultDay)

  // display a US map with each state display a color indicating one of the columns from the dataset
  // the user can choose what data to display on the map
  // TODO: render map 
}

// Potential Functions to use

function updateAxes() {
  // Remove old axes/labels (ex of new values)
}

function addLegend() {
  // Adds a legend so users can decode colors
}

function showTooltip(event, html) {
  // hovering over a datapoint should show information.
}

function hideTooltip() {
  // once clicker leaves remove hover.
}

function hoverLocation(rows, title) {
  // shows: lat / long / elev
}

function hoverTemperature(rows, title) {
  // shows: min / max / avg temp
}

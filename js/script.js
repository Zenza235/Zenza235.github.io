// set margin
const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const path = './data/weather.csv'

// dataset col names
const COLS = ["station", "state", "latitude", "longitude", "elevation", "date",
  "TMIN", "TMAX", "TAVG", "AWND", "WDF5", "WSF5", "SNOW", "SNWD", "PRCP"]

// US state abbrevs
const states = {
  AL: { name: "Alabama" },
  AK: { name: "Alaska" },
  AZ: { name: "Arizona" },
  AR: { name: "Arkansas" },
  CA: { name: "California" },
  CO: { name: "Colorado" },
  CT: { name: "Connecticut" },
  DE: { name: "Delaware" },
  FL: { name: "Florida" },
  GA: { name: "Georgia" },
  HI: { name: "Hawaii" },
  ID: { name: "Idaho" },
  IL: { name: "Illinois" },
  IN: { name: "Indiana" },
  IA: { name: "Iowa" },
  KS: { name: "Kansas" },
  KY: { name: "Kentucky" },
  LA: { name: "Louisiana" },
  ME: { name: "Maine" },
  MD: { name: "Maryland" },
  MA: { name: "Massachusetts" },
  MI: { name: "Michigan" },
  MN: { name: "Minnesota" },
  MS: { name: "Mississippi" },
  MO: { name: "Missouri" },
  MT: { name: "Montana" },
  NE: { name: "Nebraska" },
  NV: { name: "Nevada" },
  NH: { name: "New Hampshire" },
  NJ: { name: "New Jersey" },
  NM: { name: "New Mexico" },
  NY: { name: "New York" },
  NC: { name: "North Carolina" },
  ND: { name: "North Dakota" },
  OH: { name: "Ohio" },
  OK: { name: "Oklahoma" },
  OR: { name: "Oregon" },
  PA: { name: "Pennsylvania" },
  RI: { name: "Rhode Island" },
  SC: { name: "South Carolina" },
  SD: { name: "South Dakota" },
  TN: { name: "Tennessee" },
  TX: { name: "Texas" },
  UT: { name: "Utah" },
  VT: { name: "Vermont" },
  VA: { name: "Virginia" },
  WA: { name: "Washington" },
  WV: { name: "West Virginia" },
  WI: { name: "Wisconsin" },
  WY: { name: "Wyoming" }
};


let mapData = []
let chartData = []
let allData = []

// let byState = new Map();   // state -> [rows]
// let byStation = new Map(); // state -> Map(station -> [rows])

// some values are empty and need to checked before conversion
const nothingOrNum = val => (val == '' || val == null) ? null : +val

//state and station dropdown filter
const filters = { state: null, variable: 'TAVG', day: 109 } // values are defaults

// transition time
const t = 1000;

const title_y = - margin.top / 2 + 10

const variableLabels = {
  TAVG: { label: 'Average Temperature (°F)' },
  TMIN: { label: 'Minimum Temperature (°F)' },
  TMAX: { label: 'Maximum Temperature (°F)' },
  PRCP: { label: 'Precipitation (inches)' },
  SNOW: { label: 'Snowfall (inches)' },
  AWND: { label: 'Average Wind Speed (mph)' }
};

const colorInterpolaters = {
  TAVG: t => d3.interpolateRdYlBu(1 - t),
  TMIN: t => d3.interpolateRdYlBu(1 - t),
  TMAX: t => d3.interpolateRdYlBu(1 - t),
  PRCP: d3.interpolateMagma,
  SNOW: d3.interpolateMagma,
  AWND: d3.interpolateMagma,
}

let legendSize = 10  // Size of the legend squares

// Create the map SVG before the other visualizations so it appears above them.
const mapSvg = d3.select('#vis')
  .append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`);

mapSvg.append('g').attr('class', 'vis-country-map');

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

// Initialization
function init() {
  d3.csv(path, d => {
    // console.log("Raw CSV row:", d) // debugging
    parsed_date = parseDateGetDayOfYear(d.date)
    const row = {
      station: d.station,
      state: d.state, // state abbr (e.g. MD, TX, etc.)
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
      console.log(data) // Check structure
      allData = data
      const variableNames = COLS.slice(6);
      const flatData = data.flatMap(row =>
        states[row.state] == null
          ? []
          : variableNames
            .filter(variable => Number.isFinite(row[variable]))
            .map(variable => ({
              dayOfYear: row.dayOfYear,
              variable,
              state: row.state,
              value: row[variable]
            }))
      );
      mapData = d3.rollup(
        flatData,
        rows => d3.mean(rows, d => d.value),
        d => d.dayOfYear,
        d => d.variable,
        d => d.state
      );
      chartData = d3.rollup(
        flatData,
        rows => d3.mean(rows, d => d.value),
        d => d.state,
        d => d.variable,
        d => d.dayOfYear
      );
      // console.log(flatData);
      // console.log(mapData);
      // console.log(chartData);

      // buildGroupings() // group by state and stations
      setupMap();
      setupSelector();
      updatePlotVis();
    })
    .catch(error => console.error('Error loading data:', error));
}

window.addEventListener('load', init);

/* Data Helpers */

// make date readable, and get day within 365 days
// example "20170312" -> { date: Date(2017, 2, 12), dayOfYear: 71 }
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

function weatherClassifier(d) {
  if ((d.SNOW != null && d.SNOW > 0) || (d.SNWD != null && d.SNWD > 0)) return 'snowy';
  if (d.PRCP != null && d.PRCP > 0 &&
    ((d.SNOW == null || d.SNOW === 0) && (d.SNWD == null || d.SNWD === 0))) return 'rainy';
  if ((d.WSF5 != null && d.WSF5 > 0) || (d.AWND != null && d.AWND > 0)) return 'windy';
  return 'clear'
}

function nameToAbbr(stateName) {
  return Object.keys(states).find(abbr => states[abbr].name === stateName);
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


function setupSelector() {
  // Create date slider
  let slider = d3
    .sliderHorizontal()
    .min(1)
    .max(365)
    .step(1)
    .width(width - 40)
    .displayValue(false)
    .tickValues([1, 60, 121, 182, 244, 305, 365])
    .tickFormat(formatDay)
    .default(filters.day)
    .on('onchange', (val) => {
      filters.day = +val;
      // console.log(
      //   "Numerical day:", defaultDay,
      //   "Calendar day:", formatDay(defaultDay)
      // );

      // SHOULD UPDATE MAP COLORS & CHART'S ORANGE LINE; ideally nothing else
      updateMapVis();
      updatePlotVis();
    });

  // Remove any existing slider
  d3.select('#dateSlider')
    .selectAll('svg')
    .remove();

  // Display the slider
  d3.select('#dateSlider')
    .append('svg')
    .attr('width', width + 20)
    .attr('height', 100)
    .append('g')
    .attr('transform', 'translate(30,30)')
    .call(slider);

  // Variable dropdown
  d3.select('#variableSelection')
    .on('change', function () {
      filters.variable = this.value;
      // UPDATES MAP & CHART
      updateMapVis();
      updatePlotVis();
    });
}

function setupMap() {
  const map = mapSvg.select('.vis-country-map');
  const usTopologyUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-albers-10m.json";

  d3.json(usTopologyUrl).then(us => {
    console.log(us)
    // Draw States
    const stateFeatures = topojson.feature(us, us.objects.states).features;
    console.log(stateFeatures);
    const projection = d3.geoIdentity()
      .fitSize([width, height], { type: 'FeatureCollection', features: stateFeatures });

    const zoom = 1.15;
    const [translateX, translateY] = projection.translate();
    projection.scale(projection.scale() * zoom)
      .translate([
        width / 2 - zoom * (width / 2 - translateX) - 30,
        height / 2 - zoom * (height / 2 - translateY)
      ]);

    const path = d3.geoPath(projection);

    // Drawing that US and its states
    map.selectAll("path")
      .data(stateFeatures)
      .join("path")
      .attr("d", path)
      .style("stroke", "white")
      .attr("class", "state")
      .style("opacity", .8)
      .style("cursor", "pointer")
      .on("click", function (event, feature) {
        map.selectAll(".state")
          .style("stroke", "white")
          .style("stroke-width", null);
        map.selectAll(".selected-state-outline")
          .data([feature])
          .join("path")
          .attr("class", "selected-state-outline")
          .attr("d", path)
          .attr("fill", "none")
          .attr("stroke", "black")
          .attr("stroke-width", 2)
          .attr("pointer-events", "none")
          .raise();

        filters.state = nameToAbbr(feature.properties.name);
        console.log(`new state of interest = ${filters.state}`);
        updatePlotVis();
      });

    // Map title & subtitle
    map.append("text")
      .attr("class", "map-title")
      .attr("x", (width / 2))
      .attr("y", title_y)
      .attr("text-anchor", "middle")
      .style("font-size", "20px")
      .attr("fill", "black")
      .text(variableLabels[filters.variable].label);

    map.append("text")
      .attr("class", "map-subtitle")
      .attr("x", (width / 2))
      .attr("y", title_y + 30)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .attr("fill", "black")
      .text(`${formatDay(filters.day)}, 2017`); // all data is from 2017

    updateMapVis();
  }).catch(error => {
    console.error("Error loading the geographic data: ", error);
  });
}




function updateMapVis() {
  const map = mapSvg.select('.vis-country-map');

  // get all data 
  const currMapData = mapData.get(filters.day)?.get(filters.variable);

  

  const values = Array.from(currMapData?.values() ?? []).filter(Number.isFinite);
  const [minValue, maxValue] = d3.extent(values);
  const domain = minValue === maxValue ? [minValue - 1, maxValue + 1] : [minValue ?? 0, maxValue ?? 1];

  const colorScale = d3.scaleSequential()
    .domain(domain)
    .interpolator(colorInterpolaters[filters.variable]);

  map.selectAll(".state")
    // placed below in the function.
    // .on("mouseenter", function (event, d) {
    //     const states = d3.select(this.parentNode).selectAll(".state");
    //     states.interrupt().style("opacity", .5);

    //     d3.select(this)
    //         .interrupt()
    //         .style("opacity", 1);

    // Display tool tip
    .on("mouseover", mapMouseOver)
    .on("mousemove", function (event) {
      d3.select('#tooltip')
        .style('left', (event.pageX + 20) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on("mouseout", function () {
      hideTooltip();
      d3.select(this.parentNode).selectAll(".state")
        .interrupt()
        .style("opacity", .8);
    })
    .transition()
    .duration(120)
    .attr('fill', d => {
      const state = nameToAbbr(d.properties.name);
      const value = currMapData?.get(state);
      return Number.isFinite(value) ? colorScale(value) : "lightgray";
    });
  map.on("mouseleave", function (event, d) {
    d3.select(this).selectAll(".state")
      .interrupt()
      .style("opacity", .8);
  });

  map.select(".map-title")
    .text(variableLabels[filters.variable].label);

  map.select(".map-subtitle")
    .text(`${formatDay(filters.day)}, 2017`);
}

function updatePlotVis() {
  const plot = svg.select('.vis-line-plot');

  const currChartData = Array.from(
    chartData.get(filters.state)?.get(filters.variable) ?? [],
    ([dayOfYear, value]) => ({
      dayOfYear,
      date: new Date(2017, 0, dayOfYear - 1),
      value
    }))
    .filter(d => Number.isFinite(d.value))
    .sort((a, b) => a.dayOfYear - b.dayOfYear);

  // Stop if there is no data for the selected variable
  if (currChartData.length === 0) {
    plot.selectAll('.temperature-line').remove();
    plot.selectAll('.no-data').remove();

    plot.append('text')
      .attr('class', 'no-data')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .text('Select a state to view its data.');

    return;
  }

  plot.selectAll('.no-data').remove();

  // X-axis: calendar dates
  const xScale = d3.scaleTime()
    .domain([new Date(2017, 0, 1), new Date(2017, 11, 31)])
    .range([0, width]);

  // Y-axis: selected weather measurement
  let minValue = d3.min(currChartData, d => d.value);
  let maxValue = d3.max(currChartData, d => d.value);

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

  plot.select('.plot-title').remove();
  plot.select('.plot-subtitle').remove();

  plot.append("text")
    .attr("class", "plot-title")
    .attr("x", (width / 2))
    .attr("y", title_y)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .attr("fill", "black")
    .text(`${variableLabels[filters.variable].label} in 2017`);

  plot.append("text")
    .attr("class", "plot-subtitle")
    .attr("x", (width / 2))
    .attr("y", title_y + 30)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .attr("fill", "black")
    .text(states[filters.state].name); // all data is from 2017

  // Create the line generator
  const line = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.value));

  // Draw or update the line
  plot.selectAll('.temperature-line')
    .data([currChartData])
    .join('path')
    .attr('class', 'temperature-line')
    .attr('fill', 'none')
    .attr('stroke', '#2878b5')
    .attr('stroke-width', 2)
    .attr('d', line);

  // Find the data for the selected date
  const selectedPoint = currChartData.find(d => d.dayOfYear === filters.day);

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
    .data(currChartData)
    .join('circle')
    .attr('class', 'hover-point')
    .attr('cx', d => xScale(d.date))
    .attr('cy', d => yScale(d.value))
    .attr('r', 3)
    .style('fill', 'steelblue')
    .on('mouseover', function (event, d) {
      const dayRows = [Object.fromEntries(
        Array.from(chartData.get(filters.state) ?? [], ([variable, valuesByDay]) => [
          variable,
          valuesByDay.get(d.dayOfYear)
        ])
      )];
      const title = d3.timeFormat('%B %d, %Y')(d.date);

      let html = hoverTemperature(dayRows, title);

      html += `<br/>${variableLabels[filters.variable].label}: ${d.value.toFixed(2)}`;

      const precipitation = d3.mean(
        dayRows,
        row => row.PRCP
      );

      html += `<br/>Precipitation: ${precipitation == null
        ? 'N/A'
        : precipitation.toFixed(2) + ' inches'
        }`;

      showTooltip(event, html);

      d3.select(this)
        .style('stroke', 'black')
        .style('stroke-width', '2px');
    })
    .on('mousemove', function (event) {
      d3.select('#tooltip')
        .style('left', (event.pageX + 20) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function () {
      hideTooltip();

      d3.select(this)
        .style('stroke', 'none')
        .style('stroke-width', '0px');
    });
}

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
  // shows: general lat and long and highest and lowest elevation. 
  // shows three most common weather types.

  const byStation = d3.rollup(
    rows,
    rs => ({
      latitude: d3.mean(rs, r => r.latitude),
      longitude: d3.mean(rs, r => r.longitude),
      elevation: d3.mean(rs, r => r.elevation)
    }),
    r => r.station
  );

  const stations = Array.from(byStation.values());

  const lat = d3.mean(stations, s => s.latitude);
  const long = d3.mean(stations, s => s.longitude);
  //const elev = d3.mean(rows, d => d.elevation);

  const minElev = d3.min(stations, s => s.elevation);
  const maxElev = d3.max(stations, s => s.elevation);

  const lat_dir = lat == null ? 'N/A' : (lat >= 0 ? 'N' : 'S')
  const long_dir = long == null ? 'N/A' : (long >= 0 ? 'E' : 'W')

  const weatherCounts = d3.rollup(rows, rl => rl.length, r => weatherClassifier(r));

  const topWeather = Array.from(weatherCounts, ([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const weatherHtml = topWeather.length === 0 ? '<em>No weather data</em>'
    : topWeather.map(({ type, count }) => {
      const color = weatherIcon(type);
      return `
                <div>
                    <span style="
                        display:inline-block;
                        width:12px;
                        height:12px;
                        border-radius:50%;
                        background:${color};
                        border:1px solid #333;
                    "></span>
                    <span>${type} — ${count} occurances.</span>
                </div>`;
    }).join('');

  return `
        <strong>${title}</strong><br/>
        Latitude: ${lat == null ? 'N/A' : Math.abs(lat).toFixed(2) + ' °' + lat_dir}<br/>
        Longitude: ${long == null ? 'N/A' : Math.abs(long).toFixed(2) + ' °' + long_dir}<br/>
        Max Elevation: ${maxElev == null ? 'N/A' : maxElev.toFixed(2) + ' m'}<br/>
        Min Elevation: ${minElev == null ? 'N/A' : minElev.toFixed(2) + ' m'}<br/>
        <br/><strong>Most Common Weather:</strong><br/>
        ${weatherHtml}
    `;
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


function mapMouseOver(event, d) {
  const statePaths = d3.select(this.parentNode).selectAll(".state");
  statePaths.interrupt().style("opacity", 0.5);
  d3.select(this).interrupt().style("opacity", 1);

  const stateAbbr = nameToAbbr(d.properties.name);
  if (!stateAbbr) { return; }

  const stateRows = allData.filter(row => row.state === stateAbbr);

  const title = `${states[stateAbbr].name} — ${formatDay(filters.day)}`;

  let html = hoverLocation(stateRows, title);

  showTooltip(event, html);
}
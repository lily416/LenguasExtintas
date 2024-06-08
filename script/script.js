// Constantes
const degrees = [
    'Vulnerable',
    'Definitely endangered',
    'Severely endangered',
    'Critically endangered',
    'Extinct'
];
const spanishDegrees = {
    'Vulnerable': 'Vulnerable',
    'Definitely endangered': 'Definitivamente en peligro',
    'Severely endangered': 'Severo peligro',
    'Critically endangered': 'Peligro crítico',
    'Extinct': 'Extinto',
}
const speakerDomain = [0, 2**6, 4**6, 6**6].map(d => d - 1);
const maxSpeakers = 7500000;
const maxSliderSpeakers = 7000;
const minSpeakers = 0;

// Variables globales
let k = 1;
let oldHeight;
let showSpeakers = d3.select('#speakersSwitch').property('checked');
let showConnections = d3.select('#connectionSwitch').property('checked');
let idDegreeSwitchs = {};

let rangeSpeakers = [minSpeakers, maxSpeakers];
let activeDegrees = {}

degrees.forEach((d) => {
    const degree = d.toLowerCase().split(' ')[0];
    idDegreeSwitchs[`${degree}Switch`] = d;
    activeDegrees[d] = true;
})

// Generamos la visualización
const chargeMap = async (width, height, margin) => {
    // Generamos el canvas
    const svg = d3.select('#map')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Cargamos los datos
    const geoData = await d3.json('data/countries.geojson');

    const languages = await d3.csv(
        'data/data.csv',
        (row) => {
            return {
                // ...row,
                id:         row.id,
                lat:        +row.Latitude,
                lon:        +row.Longitude,
                speakers:   +row['Number of speakers'],
                degree:     row['Degree of endangerment'],
                name:       row['Name in English'],
                nativeName: row['Name in the language'],
                family:     row['Family'],
                subgruop:   row['Subgroup'],
            }
        });

    // Generamos las conexiones entre ellos
    const connections = languages.filter((d) => d.family != '').map((d) => {
        let node = {id: d.id};
        node['connections'] = languages
            .filter((_d) => _d.family === d.family)
            .map((_d) => {
                return {
                    source: { lat: d.lat, lon: d.lon }, 
                    target: { lat: _d.lat, lon: _d.lon},
            }});
        return node;
    });

    // Generamos los contenedores y grupos
    const container = svg.append('g')
        .attr('transform', `translate(${margin.horizontal}, ${margin.vertical})`);

    const countries = container.append('g')
        .attr('id', 'countries');

    const links = container.append('g')
        .attr('id', 'links');

    const dots = container.append('g')
        .attr('id', 'dots')
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round');

    const degreeLabels = svg.append('g')
        .attr('id', 'degreeLabels');

    const speakerLabels = svg.append('g')
        .attr('id', 'speakerLabels');

    // Generamos la escala y los path del mapa
    const geoScale = d3
        .geoMercator()
        .fitSize(
            [width - 2 * margin.horizontal, height - 2 * margin.vertical],
            geoData
        );

    const geoPath = d3
        .geoPath()
        .projection(geoScale);

    // Generamos las escalas que usaremos y funciones relacionadas
    const radiuScale = d3.scaleThreshold()
        .domain(speakerDomain)
        .range([4, 6, 8, 10, 12]);

    const dotsSize = (d) => showSpeakers ? radiuScale(d.speakers) / k : 6 / k;

    const colorScale = d3.scaleOrdinal()
        .domain(degrees)
        .range(['#12494C', '#0F9398', '#F58C0F', '#DC1F3D', '#872E5C']);

    // Creamos el tooltip 
    /* Basado en https://stackoverflow.com/questions/35623333/tooltip-on-mouseover-d3 */
    const tooltip = d3.select('body')
        .append('div')
        .attr('id', 'tooltip')
        .style('position', 'absolute')
        .style('z-index', '10')
        .style('visibility', 'hidden');

    ['name', 'nativeName', 'speakers', 'family', 'subgroup'].forEach(attr => {
        tooltip.append('div').attr('id', attr);
    })

    const tooltipMouseMove = function(e, d) {
        tooltip
            .style('top', `${e.pageY - 10}px`)
            .style('left', `${e.pageX + 15}px`)
            .style('visibility', 'visible')

        tooltip.select('#name')
            .text(d.name);

        tooltip.select('#nativeName')
            .text(d.nativeName);

        tooltip.select('#speakers')
            .text(`Hablantes: ${String(d.speakers).replace(/\d(?=(?:\d{3})+$)/g, '$&.')}`);
            // Fuente: https://stackoverflow.com/a/50027073/8413977

        tooltip.select('#family')
            .text(showConnections ? `Familia: ${d.family}` : '')

        tooltip.select('#subgroup')
            .text(showConnections ? `Subgrupo: ${d.subgruop}` : '')
    }

    const tooltipMouseLeave = function() {
        tooltip
            .style('visibility', 'hidden'); 
    } 

    // Cargamos el mapa
    countries
        .selectAll('path')
        .data(geoData.features)
        .join('path')
            .attr('d', geoPath)
            .attr('fill', '#f5f5f5')
            .attr('stroke', '#c9c9c9')
            .attr('stroke-width', 0.5 / k);

    // Cargamos las conecciones
    /* Basado en https://observablehq.com/@d3/arc-diagram
                 https://stackoverflow.com/questions/35705018/drawing-d3-chart-from-array-of-arrays-of-objects */
    links
        .selectAll('.collection')
        .data(connections)
        .join('g')
        .attr('class', 'collection')
        .attr('id', (d) => `links_${d.id}`)
        .style('opacity', 0)
        .attr('stroke', '#a0a0a0')
        .attr('stroke-width', 3 / k)
        .attr('fill', 'none')

    const arc = (d) => {
        const target = geoScale([d.target.lon, d.target.lat]);
        const source = geoScale([d.source.lon, d.source.lat]);
        return `M${source[0]},${source[1]}L${target[0]},${target[1]}`
    }

    links.selectAll('.collection')
        .selectAll('path')
        .data(function(d) { return d.connections })
        .join('path')
            .attr('d', arc)

    const selectLink = (d) => {
        links.select(`#links_${d.id}`)
            .transition()
            .duration(500)
            .style('opacity', 0.6);

        dots.selectAll('path')
            .filter(_d => _d.family !== d.family)
            .transition()
            .duration(500)
            .attr('stroke', '#a0a0a0');
    }

    const deselectLink = (d) => {
        links.select(`#links_${d.id}`)
            .transition()
            .duration(500)
            .style('opacity', 0);

        dots.selectAll('path')
            .filter(_d => _d.family !== d.family)
            .transition()
            .duration(500)
            .attr('stroke', _d => colorScale(_d.degree));
    }

    // Cargamos los puntos
    /*  Basado en https://observablehq.com/@d3/zoomable-scatterplot
        ya que al usar circulos, no se podía limitar el radio al hacer zoom */
    await dots
        .selectAll('path')
        .data(languages)
        .join('path')
            .attr('x', d => geoScale([d.lon, d.lat])[0])
            .attr('y', d => geoScale([d.lon, d.lat])[1])
            .attr('d', d => `M${geoScale([d.lon, d.lat])[0]},${geoScale([d.lon, d.lat])[1]}h0`)
            .attr('stroke', d => colorScale(d.degree))
            .attr('stroke-width', dotsSize)
        .on('mousemove', (e, d) =>  tooltipMouseMove(e, d))
        .on('mouseenter', (_, d) => { showConnections && selectLink(d) })
        .on('mouseleave', (_, d) => { tooltipMouseLeave() || showConnections && deselectLink(d) });

    // Creamos y manejamos el zoom y panning
    const zoom = d3.zoom()
        .extent([
            [0, 0],
            [width, height]
        ])
        .translateExtent([
            [-margin.horizontal, -margin.vertical],
            [width + margin.horizontal, height + margin.vertical]
        ])
        .scaleExtent([1, 30])
        .on('zoom', (e) => {
            k = e.transform.k;
            container.attr('transform', e.transform);
            dots.selectAll('path')
                .attr('stroke-width', dotsSize);
            countries.selectAll('path')
                .attr('stroke-width', 0.5 / k)
            links.selectAll('g')
                .attr('stroke-width', 3 / k)
        });

    svg.call(zoom);

    // Manejamos los cambios de los switchs
    const changeSize = () => {
        showSpeakers = !showSpeakers;
        dots.selectAll('path')
            .transition()
            .duration(500)
            .attr('stroke-width', dotsSize);

        speakerLabels
            .transition()
            .duration(500)
            .style('opacity', showSpeakers ? 1 : 0)
    }

    const restartSliders = () => {
        const sliders = d3.select('.range-slider').selectAll('input')._groups[0];
        sliders[0].value = minSpeakers;
        sliders[1].value = maxSliderSpeakers;
        sliders[0].disabled = showConnections;
        sliders[1].disabled = showConnections;

        d3.select('.range-slider').select('.rangeValues')
            .text([minSpeakers, maxSliderSpeakers].map(
                d => String(d).replace(/\d(?=(?:\d{3})+$)/g, '$&.')).join(' - ') + '+'
                );
    }

    const restartSwitchs = () => {
        degrees.forEach((d) => {
            const degree = d.toLowerCase().split(' ')[0]
            d3.select(`#${degree}Switch`)
                .property('checked', true)

            // A través de d3 no se logra bloquear correctamente
            document.getElementById(`${degree}Switch`).disabled = showConnections;
        });
    }

    const updateDots = async () => {
        dots.selectAll('path')
            .style('visibility', 'visible');

        await dots.selectAll('path')
            .transition()
            .duration(500)
            .style('opacity', 1)
            .filter(d => (d.speakers < rangeSpeakers[0] || d.speakers > rangeSpeakers[1] || !activeDegrees[d.degree]))
            .style('opacity', 0)
            .end();
            
        dots.selectAll('path')
            .filter(d => (d.speakers < rangeSpeakers[0] || d.speakers > rangeSpeakers[1]))
            .style('visibility', 'hidden');
    }

    const changeConnections = async () => {
        showConnections = !showConnections;

        // Deshabilitamos los filtros
        restartSwitchs()
        restartSliders()

        // Aplicamos las conexiones
        await dots.selectAll('path')
            .transition()
            .duration(500)
            .style('opacity', 1)
            .style('visibility', 'visible')
            .filter(d => d.family === '')
            .style('opacity', showConnections ? 0 : 1)
            .end();

        if (showConnections) {
            dots.selectAll('path')
                .filter(d => d.family === '')
                .style('visibility', 'hidden');
        }
    }

    const changeDegree = async (e) => {
        const degree = idDegreeSwitchs[e.target.id];
        activeDegrees[degree] = d3.select(`#${e.target.id}`).property('checked');

        updateDots();
    }

    const changeSpeakers = async () => {
        const range = d3.select('.range-slider');
        const inputs = range.selectAll('input')._groups[0];
        rangeSpeakers = [inputs[0].value, inputs[1].value].map(d => +d).sort((a, b) => a - b);

        range.select('.rangeValues')
            .text(rangeSpeakers.map(
                d => String(d).replace(/\d(?=(?:\d{3})+$)/g, '$&.')).join(' - ') + 
                (rangeSpeakers[1] === maxSliderSpeakers ? '+' : '')
                );

        if (rangeSpeakers[1] === maxSliderSpeakers) { rangeSpeakers[1] = maxSpeakers }
    
        updateDots();
    }

    d3.select('#speakersSwitch')
        .on('click', changeSize);
    
    d3.select('#connectionSwitch')
        .on('click', changeConnections);

    degrees.forEach((d) => {
        const degree = d.toLowerCase().split(' ')[0];
        d3.select(`#${degree}Switch`)
            .on('click', changeDegree);
    });

    d3.select('.range-slider')
        .selectAll('input')
        .on('click', changeSpeakers);

    // Generamos la leyenda
    degreeLabels.selectAll('g')
        .data(d3.entries(spanishDegrees))
        .join(
            enter => {
                group = enter.append('g')
                    .attr("transform", (_, i) => `translate(20, ${(i + 1) * 15 + 20})`)

                group.append('text')
                    .text((d, i) => d.value)

                group.append('circle')
                    .attr('r', 3)
                    .attr("transform", 'translate(-6, -3)')
                    .attr('fill', (d) => colorScale(d.key))

                enter.append('text')
                    .text('Grado de peligro')
                    .attr("transform", `translate(10, 20)`)
            }
        )

    speakerLabels.selectAll('g')
        .data(speakerDomain)
        .join(
            enter => {
                group = enter.append('g')
                    .attr("transform", (_, i) => `translate(24, ${height - 20 - i * 15})`)

                group.append('text')
                    .text((d) => d + 1)
                
                
                group.append('path')
                    .attr('fill', 'none')
                    .attr('stroke-linecap', 'round')
                    .attr('stroke-width', (d) => radiuScale(d) + 2)
                    .attr('stroke', '#f5f5f5')
                    .attr('d', `M0,0h0`)
                    .attr("transform", 'translate(-10, -3)')


                group.append('path')
                    .attr('fill', 'none')
                    .attr('stroke-linecap', 'round')
                    .attr('stroke-width', (d) => radiuScale(d))
                    .attr('stroke', 'black')
                    .attr('d', `M0,0h0`)
                    .attr("transform", 'translate(-10, -3)')

                enter.append('text')
                    .text('Cantidad de hablantes')
                    .attr("transform", `translate(10, ${height - 20 - speakerDomain.length * 15})`)
            }
        )

}

const resizeWindow = () => {
    const infoWidth = Math.max(200, window.innerWidth * 1 / 7)
    const height = window.innerHeight - 82;

    console.log(infoWidth, height, oldHeight)

    d3.select('#information')
        .style('width', infoWidth + 'px')
        .style('height', height + 'px');
    d3.select('svg')
        .attr('width', window.innerWidth - infoWidth)
        .attr('height', height - 10)
        .select('#speakerLabels')
            .attr("transform", `translate(0, ${height - oldHeight})`)
}

const infoWidth = Math.max(200, window.innerWidth * 1 / 7)
const height = window.innerHeight - 82;
oldHeight = height;

d3.select('#information')
    .style('width', infoWidth + 'px')
    .style('height', height + 'px');

const MAP_WIDTH = window.innerWidth * 5 / 7; 
const MAP_HEIGHT = window.innerHeight - 82 - 10;
const MAP_MARGIN = {
    vertical:   20,
    horizontal: 20,
};

chargeMap(window.innerWidth - infoWidth, height - 10, MAP_MARGIN);

window.addEventListener("resize", resizeWindow);
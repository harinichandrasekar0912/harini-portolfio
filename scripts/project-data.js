(function () {
  /*
    Image structure for each finished project (AVIF with a WebP fallback; the viewer asks for the .avif sibling when the browser can decode it):
    assets/images/work/project-id/thumb-800.webp / thumb-1200.webp   overview tile (index.html, 7:5, srcset)
    assets/images/work/project-id/hero-1600.webp                     "image" below: viewer hero + first panel (7:5)
    assets/images/work/project-id/panel-02.webp ... panel-NN.webp    one image per later panel: a "board" composed of several whole
                                                                     pictures (the important ones larger), about 0.95 to 1.85 wide

    Panels: the first has only "heading" and "body" (its picture is the project image above); every later panel has
      heading, body, image, alt and ratio (width / height of the picture; the viewer sizes the frame from it, nothing is cropped).
    Pictures inside the popup are shown in colour; the overview tiles are grey (CSS).
    Overview tiles load lazily; viewer images load only when a project is opened (the hero and panel 2 are warmed when a tile is
    hovered or touched, the other panels are requested as they come near the screen).
    "meta" is an optional one-line fact strip under the summary on the first panel.
  */
  window.HariniProjectData = [
    {
      id: "project-01",
      title: "pause",
      image: "assets/images/work/project-01/hero-1600.webp",
      alt: "Render of the Buckingham Canal edge: a stone arched bridge crosses still water beside a planted two-storey framework, with two people walking along the bank.",
      summary: "Can a station slow us down? An adaptive reuse proposal for the Thiruvanmiyur MRTS station and the Buckingham Canal edge, Chennai. Students, workers and travellers move between obligations, with little reason to notice the spaces they pass through. In the midst of chaos, can you be courageous enough to be calm?",
      meta: "adaptive reuse, public realm · 2025 · revit, d5 render, photoshop · academic group project, team of 2",
      panels: [
        {
          heading: "pause",
          body: ""
        },
        {
          heading: "opening up the station",
          body: "Remove. Open. Plant. Connect. The design starts by subtracting: removing low floor plates, opening the canal-facing side and filtering western light through a jaali. Beneath the viaduct, a planted structural framework makes a shaded public route. Reuse before replacement: the existing concrete viaduct, an inserted structural framework and a planted public edge. Left, the exploded isometric; right, the framework walkway under creepers and the canal-side promenade.",
          image: "assets/images/work/project-01/panel-02.webp",
          alt: "A tall exploded isometric of the station in pale layers with an inserted red framework, beside a render of a walkway under a braced framework covered with creepers and a render of a canal-side promenade at sunset.",
          ratio: 1.28
        },
        {
          heading: "reclaiming the station's volume",
          body: "Opening the existing structure to light and public occupation. The long section runs the length of the station and viaduct; removing the low intermediate floor plates opens up a generous vertical volume inside. Below, two cross-sections: one from the road and a raised walkway across the framed building to the canal, a new relationship with the water's edge; one through the station, with more height and a more open interior.",
          image: "assets/images/work/project-01/panel-03.webp",
          alt: "A long section drawn along the station and the planted viaduct, above two cross-sections: one from a road and raised walkway across a two-storey frame to the canal, one through the station with a pitched roof over a tall central volume and staircases on both sides.",
          ratio: 1.453
        },
        {
          heading: "designing the pause",
          body: "Stillness is translated into four spatial cues rather than a single quiet room: framed views, filtered light, transparent edges and planting offer moments to notice, reorient and stay, while circulation continues around them. Inside, a public room: reclaimed volume, everyday activity and places to linger. The render shows the station interior with the opened-up volume.",
          image: "assets/images/work/project-01/panel-04.webp",
          alt: "Render of the opened-up station interior: tall concrete columns, galleries with railings, a timber floor, planters with young trees and a person sitting on a bench.",
          ratio: 1.405
        },
        {
          heading: "a different commute",
          body: "One journey, eight moments. A storyboard of a familiar commute tests how a station offering shade, views and places to sit could change the journey from a route to an experience. Above it, the plinth-level plan with its shops, food court and canal-side walkway, and the plan strip with the five render views.",
          image: "assets/images/work/project-01/panel-05.webp",
          alt: "Three long drawings stacked: the plinth-level plan along the canal edge, a plan strip with five round render views set on it, and a storyboard of eight frames following one commute.",
          ratio: 1.735
        },
        {
          heading: "public space beyond transit",
          body: "A place to gather, rest and remain. Under the viaduct, the framework turns leftover infrastructure into a usable public room with stairs and shops. The shopping complex and food court connect the residential area, the IT corridor and the canal edge. In the midst of chaos, a place to pause.",
          image: "assets/images/work/project-01/panel-06.webp",
          alt: "Render of a public space under the viaduct: a paved court dappled with shade, a stair rising on the left, shopfronts in the middle and hanging creepers overhead.",
          ratio: 1.405
        }
      ]
    },
    {
      id: "project-02",
      title: "spatial archive",
      image: "assets/images/work/project-02/hero-1600.webp",
      alt: "Home view of the Spatial Archive prototype, where drawings, photographs, notes and two 3D models (sample apartment material) float in a dark three-dimensional field, tied together by thin threads.",
      summary: "What if where something sits could say what it means? Spatial Archive is a three-dimensional research archive, built as a working web prototype. Research for one project ends up spread across folders, and folders cannot show how the pieces relate. Here, images, notes, drawings and 3D models sit in one navigable field, and the position of each item carries part of its meaning. The apartment material shown is sample content.",
      meta: "interaction design, web prototype · 2026 · hand sketches, javascript, three.js · individual project",
      panels: [
        {
          heading: "spatial archive",
          body: ""
        },
        {
          heading: "from folders to space",
          body: "It began with four ways of keeping research: loose clutter, a folder tree, a 2D board and a 3D workspace. Folders hide how things relate, and a board keeps everything on one plane. Ten studies tested grids, frames, points and floors. Study 7, a field of dots over a floor, was developed further: the dots give position without enclosing anything, and the floor gives items somewhere to stand.",
          image: "assets/images/work/project-02/panel-02.webp",
          alt: "Hand-drawn sheet with four ways of keeping research across the top, from loose clutter to a three-dimensional workspace, and ten spatial studies below, with the workspace and study 7 outlined in red.",
          ratio: 1.295
        },
        {
          heading: "the chosen field",
          body: "Study 7, the dotted matrix and floor, was built as the landing field: white points on black, glowing faintly where the pointer rests. The landing page behaviour is sketched in five stages, from an empty screen to the starting field: empty, dots appear, field forms, gentle sway, inviting.",
          image: "assets/images/work/project-02/panel-03.webp",
          alt: "Study 7, a hand-drawn dotted matrix and floor outlined in red, beside the built landing page, a near-black screen with a field of white points and the words start with an idea, above a hand-drawn strip of five landing page stages.",
          ratio: 1.41
        },
        {
          heading: "placing, grouping, connecting",
          body: "Three actions organise the material: place an item, move related items together to form a group, and tie a thread to make a link explicit. The sketch shows the three steps. Below, in the built workspace, items placed close together form a group, and a thread is a manual link between two items. The content shown is sample material.",
          image: "assets/images/work/project-02/panel-04.webp",
          alt: "A hand-drawn sequence in three steps: place the assets in the workspace, move them closer to form groups, then connect them with threads. Below, two screens of the built workspace show a group of items and a thread between items (sample material).",
          ratio: 1.048
        },
        {
          heading: "workspace behaviour and depth layers",
          body: "In the first build the workspace had depth but behaved like a flat board. Items now sit on layers and can be pushed back or brought forward. Assets enter the archive, form groups and connect across them. A 2D workspace works only along X and Y, a 3D workspace also along Z, depth. The same view, before and after an item is pushed back one layer (sample material).",
          image: "assets/images/work/project-02/panel-05.webp",
          alt: "Two hand drawings of the workspace: asset types entering a three-dimensional workspace, and three groups of items tied by red threads above a row from product to connections. To the right, a hand drawing of a flat 2D workspace beside a 3D one, and two screenshots of the same view before and after an item is pushed back one layer (sample material).",
          ratio: 1.241
        },
        {
          heading: "user flow and camera model",
          body: "From opening the site to a project workspace: open site, landing, enter the archive, project, select or create projects, then the project workspace. The camera model: pan looks left or right, tilt looks up or down, forward zoom moves into the archive, and recentre returns to the centre before a transition.",
          image: "assets/images/work/project-02/panel-06.webp",
          alt: "A hand-drawn row of six screens, from opening the site through the landing field and the projects page to a project workspace, above a hand-drawn diagram of the camera: three steps of recentring and zooming in, a key to pan, tilt, zoom and recentre, and a camera inside a field of dots.",
          ratio: 0.981
        },
        {
          heading: "drawn first, then built",
          body: "Transitions were planned as storyboards before they were coded. An abrupt switch between screens would break the sense of moving through one space. When a project opens, the selected card breaks into particles, a floor forms and the material settles into place. Search follows the same logic: the camera travels to the result instead of jumping to it.",
          image: "assets/images/work/project-02/panel-07.webp",
          alt: "Hand-drawn storyboard of twelve frames showing a project card breaking into dots, a floor appearing and the material settling into the workspace.",
          ratio: 1.326
        },
        {
          heading: "landing to projects",
          body: "Interface elements emerge from the navigated space: the landing page recentres and zooms, panels emerge and expand, and the projects resolve. Below, two frames of the built transition: recentre, then the projects resolve. The project names shown are sample material.",
          image: "assets/images/work/project-02/panel-08.webp",
          alt: "A hand-drawn strip of six frames moving from the dotted landing field to a grid of project tiles, above two screens of the built transition: the landing field recentring, then a grid of project tiles resolving (sample project names).",
          ratio: 1.431
        },
        {
          heading: "project entry, built",
          body: "Disintegrate, swirl, burst, floor, materialise: the selected card breaks into dust, a floor forms and the material settles into place. The frames run from the projects page to the settled workspace. The projects and images shown are sample material.",
          image: "assets/images/work/project-02/panel-09.webp",
          alt: "Five built frames of the project entry, from a card dissolving into dust and a swirl to a burst, a field of dots and a floor with footprints, beside the settled workspace with notes, drawings and models (sample material).",
          ratio: 1.743
        },
        {
          heading: "search and looking closely",
          body: "The camera travels to the matching item. Four frames: the word typed, two in flight, and the view settled on the match. Below, an image opened in the focus view, with its title, tags and notes, and a massing model turned in the focus view. Three-dimensional material can be opened, rotated and inspected on its own. The images shown are sample material.",
          image: "assets/images/work/project-02/panel-10.webp",
          alt: "Four screenshots of search, from the word render typed to the view arriving at an apartment render, above two focus views: a masterplan drawing opened large beside a panel with its title, tags and notes, and a white massing model (sample material).",
          ratio: 1.346
        },
        {
          heading: "the archive in use",
          body: "Images, PDFs, notes, drawings and 3D models share one workspace. A drawing can sit above the model it belongs to, and items open in a focus view and keep their position between sessions. It has not yet been formally tested with other people. The next step is a short think-aloud study, to see whether arranging research spatially helps people find connections. Where something sits can say what it means.",
          image: "assets/images/work/project-02/panel-11.webp",
          alt: "A flat drawing of a building massing floating above the matching white 3D massing model in the dark workspace, with a thin thread running between them (sample material).",
          ratio: 1.729
        }
      ]
    },
    {
      id: "project-03",
      title: "rainy madras",
      image: "assets/images/work/project-03/hero-1600.webp",
      alt: "A rendered view down a narrow lane in low evening sun: sunlit plaster walls, a blue drum and a wooden chair by a doorway, and wet ground with puddles and fallen leaves running back between balconied houses.",
      summary: "Can one walk show how unevenly a city is cared for? A walk from a restored lakefront into a flooded lane, Chennai, 2050. The evening after the monsoon, the lakefront promenade is dry and the drains work. Around the corner, a narrow lane is still under water, and still lived in. The invented street is filmed as one continuous walk, so the contrast between the two places is seen rather than explained.",
      meta: "environment design, cinematic lighting · 2026 · sketchup, unreal engine 5, blender · individual, personal project",
      panels: [
        {
          heading: "rainy madras",
          body: ""
        },
        {
          heading: "one street, two cities",
          body: "The street is invented, a composite inspired by Ambattur, on Chennai's western edge. A maintained promenade and storm drain line the lake. Around the corner the paving stops: fourteen houses face a narrow lane that sits lower than the road, so the water the drain cannot take collects there. The profile below, with its vertical scale exaggerated eleven times, shows standing water up to 14 cm deep.",
          image: "assets/images/work/project-03/panel-02.webp",
          alt: "A rendered view along the lakeside road in evening light, above a long section from the lake up to the promenade and down into the lane, where a pale band of standing water sits above the lowest point.",
          ratio: 1.275
        },
        {
          heading: "lakefront and lane",
          body: "Public care on the lakefront, private coping in the lane. The two sections show what the city provides and what residents do instead: municipal workers sweep and clear the drains, while residents sweep, wade, and lift their things onto high shelves. Both are drawn at the same scale, about 40 m apart along the same walk.",
          image: "assets/images/work/project-03/panel-03.webp",
          alt: "A two-part section diagram: the lakefront on the left with a shade tree, solar street light, bench and trench drain, and the lane on the right with a house in section, standing water, a raised plinth and a high shelf, above a table comparing what each side has.",
          ratio: 1.777
        },
        {
          heading: "planning the walk",
          body: "The brief began as ten shot stations along the lakefront road and the lane, with arrows for the viewer's movement. The final plan is one continuous walk: one take, seven stills, each drawn with its field of view. The street was modelled to scale from a dimensioned plan, so every level, puddle and doorstep follows from it. Site model, from above: lakefront, drain and lane.",
          image: "assets/images/work/project-03/panel-04.webp",
          alt: "Top: a plan of the promenade, road and footpath and the lane between fourteen lots, with a red camera path through seven numbered stations and their fields of view. Below: the earlier plan with ten shot stations, and a SketchUp model of the street seen from above.",
          ratio: 1.246
        },
        {
          heading: "building the world",
          body: "The street was blocked out in SketchUp from the plan and refined over thirteen passes with a fixed camera, so each change could be judged in the same view. Below, fourteen houses, each adapted differently: the north and south frontages are drawn with lot numbers, heights and the hero buildings. They are design intent, not construction drawings.",
          image: "assets/images/work/project-03/panel-05.webp",
          alt: "Thirteen views of the lane entry from the same camera in two rows, labelled Pass 1 to Pass 13, above two rows of colourful house elevations, the north and south frontages, each lot labelled.",
          ratio: 1.459
        },
        {
          heading: "stage by stage",
          body: "Six views of the lane, in order: SketchUp blockout, SketchUp dressed, Unreal import, Unreal clay, first materials, Unreal weathered. In Unreal Engine the work moved to surfaces: worn plaster, wet floors, patched doors.",
          image: "assets/images/work/project-03/panel-06.webp",
          alt: "Six views of the lane in a grid, read left to right and top to bottom: a dark SketchUp blockout, a dressed SketchUp view, then Unreal renders with imported SketchUp colours, grey clay, first materials and finally weathered plaster with wet floors.",
          ratio: 1.169
        },
        {
          heading: "surfaces and the drain",
          body: "Two options for the same wall: a richer Chennai colour with tactile paint, and a muted, more weathered palette. Choices such as which paint had faded, or how high the water stains reach, were compared side by side. Below, the drain before it was reworked, left, and in the final still, right.",
          image: "assets/images/work/project-03/panel-07.webp",
          alt: "A board comparing two surface palettes on the same two views, a richer Chennai colour with tactile paint on the left and a muted, more weathered palette on the right, above an earlier render of the lane drain and the finished backlit still.",
          ratio: 1.126
        },
        {
          heading: "light tells the story",
          body: "An overcast morning made the lane flat; a low evening sun gave it structure. On the lakefront the sky is open and the light is even; in the lane the sky narrows to a strip, so light arrives in pools, as the plan shows. The colour frames and value curve follow the walk: bright lakefront, dark lane, lighter at the end. The light changes with the place, not the time.",
          image: "assets/images/work/project-03/panel-08.webp",
          alt: "The lane entry under a flat overcast sky and in low evening sun, above a dark lighting plan showing each pool of light, a row of seven blurred colour frames and a line graph of average value along the walk: 38 percent on the lakefront, 42 percent at the drain, 18 percent in the lane and 25 percent at the far end.",
          ratio: 1.523
        },
        {
          heading: "locking the look",
          body: "Each round changed one idea at a time. Round 4 (top left) built on the depth version: a refined version, a warm palette and a cool palette, each across four shots. Three versions across every shot: FINAL4, FINAL6 (the middle ground) and FINAL5. The look was locked on FINAL6. Every version was checked in grey values before colour (the drain, bottom left).",
          image: "assets/images/work/project-03/panel-09.webp",
          alt: "Lighting studies: a board of sixteen small frames from round 4, a posterised study of the backlit drain in a few flat grey values, and a tall board comparing three lighting versions, FINAL4, FINAL6 and FINAL5, across seven shots.",
          ratio: 1.498
        },
        {
          heading: "a lane that is lived in",
          body: "The lane is poorer than the lakefront but more alive, and the everyday work of coping says more than distress would: sweeping water back to the drain, wading with a bag held clear, lifting boxes to a high shelf. Planks are laid across the water as stepping stones.",
          image: "assets/images/work/project-03/panel-10.webp",
          alt: "A rendered view along a flooded lane: a yellow bicycle in the foreground, planks laid across the water as stepping stones, and washing hung across the far end.",
          ratio: 1.756
        },
        {
          heading: "to the end of the walk",
          body: "Overflow, backlit against the low sun: the lane sits lower than the road, so the water the drain cannot take collects there. Deeper in, light arrives only in pools. At home, belongings are lifted to the high shelf. Looking back, both places are in one frame: the flooded lane runs back to the bright lakefront where the walk began.",
          image: "assets/images/work/project-03/panel-11.webp",
          alt: "Four views along the walk: a backlit drain spout gushing into a leaf-strewn puddle, a view deep into the flooded lane with a yellow bicycle and planks, a small plastered room with a high shelf of steel vessels, and a view back up the lane to the bright lakefront.",
          ratio: 1.746
        }
      ]
    },
    {
      id: "project-04",
      title: "shade",
      image: "assets/images/work/project-04/hero-1600.webp",
      alt: "Close view of a courtyard façade with rows of white vertical blades turned at an angle in front of dark glass, beside a pale vertical pier.",
      summary: "A façade study grown out of an IT office campus on Chennai's OMR, a group project by a team of 2 in the sixth-semester studio, 2025. Its courtyard façades used vertical fins that responded to the changing floor heights. In 2026, I returned to the project independently to test whether those fins could perform better environmentally, without losing the logic of the original design. First, I needed to understand the rule that placed them there.",
      meta: "façade study, climate-responsive design · 2025 to 2026 · revit, rhino, grasshopper, radiance, blender · individual study built on a group studio project, team of 2",
      panels: [
        {
          heading: "shade",
          body: ""
        },
        {
          heading: "the office campus",
          body: "The original studio project: an IT office campus on Chennai's OMR, a group project by a team of 2 in the sixth-semester studio. Staggered volumes are arranged around a central courtyard. With the aerial view: the raumplan sketch (more height means more importance), the massing sketch labelling the louvres, jaali and green roof, a perspective section with floor plates at different levels, and the front and right elevations.",
          image: "assets/images/work/project-04/panel-02.webp",
          alt: "Six drawings of the original studio project on one board: an aerial perspective of the stepped office campus around a courtyard, a raumplan sketch of boxes at different heights, a labelled massing sketch, a perspective section, and the front and right elevations.",
          ratio: 1.372
        },
        {
          heading: "the plinth plan and five levels",
          body: "The plinth level plan: the ground floor, around the central courtyard. The courtyard-facing façades are the ones selected for study. Levels 1 to 5 follow in order, two down the right and three along the bottom: the floor plates change shape from level to level around the courtyard.",
          image: "assets/images/work/project-04/panel-03.webp",
          alt: "The plinth level plan of the campus, large at top left, with the floor plans of levels 1 to 5 beside and below it, each wrapped around the courtyard.",
          ratio: 1.307
        },
        {
          heading: "the fins follow the floors",
          body: "The building steps between 3 m spaces for individual work, 6 m volumes for collaboration and 9 m shared spaces. The original fins follow the first storey of each volume, screening the occupied eye-level glazing while keeping the glass above clear for daylight. Traced against the model, the rule holds across approximately 99% of the courtyard glazing. Whether it also gave effective solar protection was still unknown.",
          image: "assets/images/work/project-04/panel-04.webp",
          alt: "View across the courtyard corner of the original building, with horizontal bands of vertical fins at different storeys and clear glass between and above them.",
          ratio: 1.488
        },
        {
          heading: "the rule behind the fins",
          body: "Each floor gets fins along its first 3 m, so there is no harsh sun at eye level; in taller spaces, light comes in high, through the clear glass. More height, more importance. The floors sit at different levels, so the fins do too. Checked against the floor slabs in the Revit model, the fin bands follow the floor plates along 99% of the courtyard glass.",
          image: "assets/images/work/project-04/panel-05.webp",
          alt: "Three section diagrams of a one, two and three storey space, each with fins on the lowest 3 m, figures at eye level and sun rays stopped by the fins, above an unfolded elevation of the west and north wings showing the fins, the floor plates and the 6 m and 9 m spaces.",
          ratio: 1.542
        },
        {
          heading: "reading chennai's sun",
          body: "The façade was tested against a year of Chennai's sun, with the building set to true north. The analysis drew attention to a problem the original pattern did not reveal: low-angle morning sunlight striking the east-facing courtyard glass. The identical fins performed unevenly across the two wings, blocking roughly two-thirds of direct sun on one façade but less than half on the other. One fin, two very different results.",
          image: "assets/images/work/project-04/panel-06.webp",
          alt: "Polar sun path diagram for Chennai, with a figure-of-eight loop for each daylight hour of the year, coloured by temperature, and arcs for the solstices and the equinox.",
          ratio: 1.104
        },
        {
          heading: "same louvre, different job",
          body: "Chennai is hot and humid all year, with the sun almost overhead (top left: temperature and humidity). Top right: direct beam and diffuse sky over a year, on a surface facing each direction. Below: direct sun on the glass behind the fins, with and without them, storey by storey. The same louvre does a different job on each wing.",
          image: "assets/images/work/project-04/panel-07.webp",
          alt: "Across the top, charts of Chennai's monthly temperature range and humidity and a radial chart of sun on surfaces facing each direction. Below, paired bar charts for the north wing and the west wing comparing direct sun on the glass with the fins removed and with the original fins, storey by storey.",
          ratio: 1.351
        },
        {
          heading: "from data to a moving fin",
          body: "Static variations in fin depth and spacing helped only modestly: of thirty fixed options for the north wing (SSW), only the deepest and densest beat the original fins, by 5 to 15%. Rather than replace the courtyard pattern, I retained the original fin bays and explored movement as the new variable. In Grasshopper, climate inputs, geometric limits and solar-response rules informed the blade configuration and hourly angles.",
          image: "assets/images/work/project-04/panel-08.webp",
          alt: "A scatter plot of thirty fixed fin options for the north wing, direct sun on the glass against view openness, with a dashed line for the original fins, above the long Grasshopper definition that takes the façade model and the measured sun and ends in blade geometry, angles and exports.",
          ratio: 1.051
        },
        {
          heading: "six-metre zones, five states",
          body: "The original fin rhythm is retained and grouped into independently controlled six-metre zones: north wing (SSW) above, west wing (ESE) below. One zone, 60 degrees either side of open: closed against low sun from one side, partial block, open and parked, partial block, closed from the other side. The façade did not need a new visual language. It needed a new way to react to the sun.",
          image: "assets/images/work/project-04/panel-09.webp",
          alt: "Two elevation diagrams, north wing above and west wing below, with the original fin bays hatched and one six-metre control zone boxed, over a row of five renders of one zone from closed at one side through open to closed at the other, labelled with their angles.",
          ratio: 1.439
        },
        {
          heading: "the fin, resolved",
          body: "The original fin zones are preserved, each six-metre bay turning its blades together on one actuator, with a fail-safe open position. Above: one zone exploded along the façade normal (curtain wall, slab-edge brackets, tie-bar, actuator, blades), and a close view of the linked blades. Below: the exploded axonometric, and the same blades through 21 April. Preliminary design development, not for fabrication.",
          image: "assets/images/work/project-04/panel-10.webp",
          alt: "An exploded view of one control zone and a close render of the linked blades on pivot shafts, above an exploded axonometric line drawing with numbered labels and six frames of the same blades through 21 April.",
          ratio: 1.644
        },
        {
          heading: "the same light, before and after",
          body: "The west wing (ESE) at 09:00 on 21 March, with the real shadows of the blades, and the blade rhythm and depth on the north wing (SSW) at 15:30 on 21 March. In each pair the original fixed fins are on the left and the same fins made kinetic are on the right.",
          image: "assets/images/work/project-04/panel-11.webp",
          alt: "Two before and after render pairs of the courtyard façade, the original fixed fins on the left and the kinetic blades on the right: the west wing in morning sun above, and a close view of the north wing below.",
          ratio: 1.482
        },
        {
          heading: "the view inside, and the numbers",
          body: "View from an upper office floor, 14:00 on 21 December: original fins left, kinetic blades right. Behind the fin bays, direct sun is 24% less (north wing) and 35% less (west wing); total solar 3% and 17% less; daylight (sDA300) 46% and 47%. Solar and daylight simulations only: a simulated design improvement, not a verified operational-energy saving. The fins still follow the floors; their angles now follow the sun.",
          image: "assets/images/work/project-04/panel-12.webp",
          alt: "A before and after render from inside an office looking out across the courtyard, above a table of big figures for each wing: direct sun on the glass, total solar, direct-sun hours, view openness and daylight, with a footnote on the method.",
          ratio: 1.198
        }
      ]
    },
    {
      id: "project-05",
      title: "staircase",
      image: "assets/images/work/project-05/hero-1600.webp",
      alt: "Render of a semicircular stair of glass treads on one curved steel spine, sweeping up across a plain room with a window wall at dusk.",
      summary: "Can a semicircular stair work with a single supporting spine and still look light? The initial design uses glass treads supported by a curved steel spine, forming a semicircular stair with an open appearance. The study examined whether the proposed form could carry the required loads. A physical model helped establish the module arrangement, followed by structural analysis and revisions.",
      meta: "structural design, design development · revit, robot structural analysis, python, blender, d5 render · individual, academic project",
      panels: [
        {
          heading: "staircase",
          body: ""
        },
        {
          heading: "first design and physical model",
          body: "Revit model of the original scheme: glass treads supported by a curved steel spine, forming a semicircular stair with an open appearance. A physical model, built by hand, helped establish the module arrangement, followed by structural analysis and revisions. It is shown from above and from low down.",
          image: "assets/images/work/project-05/panel-02.webp",
          alt: "The first Revit design as a line drawing of glass treads stepping along a curved spine, beside two views of the hand-built model: from above, black rods fanning round a half circle, and from low down, clear treads on dark frames.",
          ratio: 1.528
        },
        {
          heading: "a repeated tread module",
          body: "The stair contains twenty repeated tread assemblies around a curved steel spine. Each assembly uses steel rods to support a glass tread at four points: rods, node block, bearings and glass tread, shown exploded, repeated along the spine and as a single module. The module layout was developed through physical and digital models.",
          image: "assets/images/work/project-05/panel-03.webp",
          alt: "One tread module shown exploded, with a glass tread lifted above a dark node block, steel rods and bearing discs, beside the same module assembled and the modules repeating along the dark steel spine.",
          ratio: 1.616
        },
        {
          heading: "plan, elevation and section",
          body: "The plan is half a circle, two metres from the centre. In elevation the spine forms a half-circle and tapers along its length. The section is cut through one typical module, where a tread meets the spine.",
          image: "assets/images/work/project-05/panel-04.webp",
          alt: "Three drawings of the stair: the plan of the half circle with the twenty tread modules and the section marks, the elevation, and the section through one typical module.",
          ratio: 1.01
        },
        {
          heading: "tracing the load path",
          body: "The Revit geometry was transferred into Robot Structural Analysis, allowing the same model to be checked without rebuilding it. Load-path studies followed forces from the tread through the rods and spine, here for a 4.5 kN point load at the outer edge of a tread. Initial checks showed overstressed members, particularly in the slender rods supporting the glass corners.",
          image: "assets/images/work/project-05/panel-05.webp",
          alt: "Colour drawing of the load path through one tread: a 4.5 kN load at the glass edge passing through the bearings and rods into the spine plate, with numbered notes and an inset of the whole stair.",
          ratio: 1.552
        },
        {
          heading: "from model to analysis",
          body: "The workflow, step by step: every number in the analysis comes from the Revit model, with no geometry retyped. Below, how each module carries its tread (tension and compression), and the movement of the whole stair under a full crowd load as a colour map, not exaggerated: the largest is 4.1 mm, on the outer glass; the spine moves 2.6 mm, against a limit of 19.1 mm.",
          image: "assets/images/work/project-05/panel-06.webp",
          alt: "The eight-step workflow from the Revit model to a checked structure, with the model, the analytical model and the utilisation result; below it, force diagrams for one module and the whole stair, and a colour map of movement under a full crowd load.",
          ratio: 1.22
        },
        {
          heading: "revising the structure",
          body: "Several structural options were compared while retaining the semicircular form. Thickening the spine and adding supports beneath the stair were not taken forward. The revised scheme uses larger rods where needed, welded module connections and glass balustrades that contribute to stability. The glass balustrade became part of the structure. Left: tripod supports and a thin glass ribbon. Right: the structural glass, which Revit draws solid grey.",
          image: "assets/images/work/project-05/panel-07.webp",
          alt: "Three Revit views of the stair spine: rod tripods propping it from below, a thin glass ribbon, and the structural glass balustrade that was adopted, drawn solid grey.",
          ratio: 1.823
        },
        {
          heading: "first model and final design",
          body: "Same form, same loads, same scale: above, the first model with its failing members beside the final design; below, the design evolution in numbers. All 185 members that initially failed the modelled strength checks passed in the revised analysis. Members failing: 185, 1, then 0. Highest utilisation: 18.66, 1.14, then 0.62.",
          image: "assets/images/work/project-05/panel-08.webp",
          alt: "Two member utilisation plots, the first model with many failing members in red and the final design with none, above a results table; below, a table and bar chart of three design stages.",
          ratio: 1.031
        },
        {
          heading: "spine options and footfall",
          body: "Spine options compared at the same scale, then the footfall response of eight design options against the limit for a public stair. Improved, but not yet enough for a public stair. Proposed dampers have not yet been verified.",
          image: "assets/images/work/project-05/panel-09.webp",
          alt: "Seven spine cross-sections drawn to scale as bars for the base and the top, above a bar chart comparing the footfall response of eight design options with the limit for a public stair.",
          ratio: 1.157
        },
        {
          heading: "the revised stair",
          body: "The revised stair retains the original semicircular form. Under the modelled loads, it meets the strength checks and has limited deflection. Footfall vibration is still above the target for a busy public stair. Proposed dampers have not yet been verified, and the glass connections require further review. The work remains a preliminary structural study, not a certified design.",
          image: "assets/images/work/project-05/panel-10.webp",
          alt: "Render looking up at the revised stair from the floor of the room, with glass treads on rod frames along the curved steel spine and the glass balustrade above.",
          ratio: 1.41
        },
        {
          heading: "module and joint details",
          body: "Bearings, nodes and glass fixings: the tread bearing, node block and balustrade fixing in section, with the module seen from below and the node block in 3D. The glass connections require further review.",
          image: "assets/images/work/project-05/panel-11.webp",
          alt: "Three joint drawings at larger scale (tread bearing, node block and balustrade fixing), above a close view of the module from below and a 3D view of the node block.",
          ratio: 1.018
        },
        {
          heading: "under the flight",
          body: "A low view from under the flight: the dark curved spine below and the two glass balustrade ribbons above. One spine, twenty modules. The work remains a preliminary structural study, not a certified design.",
          image: "assets/images/work/project-05/panel-12.webp",
          alt: "Render of the whole stair from low on the underside: the dark curved spine below and the two glass balustrade ribbons above.",
          ratio: 1.259
        }
      ]
    },
    {
      id: "archive-01",
      title: "animation test",
      image: "assets/images/archive/archive-placeholder.svg",
      alt: "black and white archive placeholder for animation test",
      summary: "a small motion study prepared as an archive placeholder.",
      panels: [
        {
          heading: "title / introduction",
          body: "A compact note for a secondary animation experiment."
        },
        {
          heading: "context",
          body: "Use this panel for the prompt, tools, and constraints."
        },
        {
          heading: "concept / process",
          body: "Process frames and small iterations can sit here later."
        },
        {
          heading: "drawings / diagrams",
          body: "Place storyboard fragments, sketches, or timing diagrams here."
        },
        {
          heading: "renders / outcome",
          body: "The final clip or still sequence can close this archive entry."
        }
      ]
    },
    {
      id: "archive-02",
      title: "spatial sketch set",
      image: "assets/images/archive/archive-placeholder.svg",
      alt: "black and white archive placeholder for spatial sketch set",
      summary: "a restrained placeholder for a set of spatial sketches.",
      panels: [
        {
          heading: "title / introduction",
          body: "A short opening line can identify the sketch set."
        },
        {
          heading: "context",
          body: "Use this for where the sketches came from and what they tested."
        },
        {
          heading: "concept / process",
          body: "Later, this can collect a few crisp process fragments."
        },
        {
          heading: "drawings / diagrams",
          body: "Drawings and scans can be arranged here."
        },
        {
          heading: "renders / outcome",
          body: "A final selected frame or image group can close the entry."
        }
      ]
    },
    {
      id: "archive-03",
      title: "material study",
      image: "assets/images/archive/archive-placeholder.svg",
      alt: "black and white archive placeholder for material study",
      summary: "a small archive study for material, texture, and surface.",
      panels: [
        {
          heading: "title / introduction",
          body: "A minimal description can replace this placeholder."
        },
        {
          heading: "context",
          body: "Add the material question and study conditions here."
        },
        {
          heading: "concept / process",
          body: "Use this panel for test logic and iteration notes."
        },
        {
          heading: "drawings / diagrams",
          body: "Diagrams, close studies, and fragments can sit here."
        },
        {
          heading: "renders / outcome",
          body: "Resolved images and a short note can close the study."
        }
      ]
    },
    {
      id: "archive-04",
      title: "process fragment",
      image: "assets/images/archive/archive-placeholder.svg",
      alt: "black and white archive placeholder for process fragment",
      summary: "a compact process fragment prepared for future detail.",
      panels: [
        {
          heading: "title / introduction",
          body: "This can become a short note on a smaller process artifact."
        },
        {
          heading: "context",
          body: "Add source, brief, and timing context here."
        },
        {
          heading: "concept / process",
          body: "A focused sequence of decisions can be shown here."
        },
        {
          heading: "drawings / diagrams",
          body: "Process drawings or structural diagrams can fill this panel."
        },
        {
          heading: "renders / outcome",
          body: "Use the closing panel for a selected outcome or reflection."
        }
      ]
    }
  ];
})();

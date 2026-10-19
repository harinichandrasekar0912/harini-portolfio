(function () {
  /*
    Image structure for each finished project (AVIF with a WebP fallback; the viewer asks for the .avif sibling when the browser can decode it):
    assets/images/work/project-id/thumb-800.webp / thumb-1200.webp   overview tile (index.html, 7:5, srcset)
    assets/images/work/project-id/hero-1600.webp                     "image" below: viewer hero + first panel (7:5)
    assets/images/work/project-id/panel-02.webp ... panel-NN.webp    one image per later panel, at its own aspect ratio

    Panels: the first has only "heading" and "body" (its picture is the project image above); every later panel has
      heading, body, image, alt, ratio (width / height of the picture; the viewer sizes the frame from it, nothing is cropped),
      and optionally colour: true (keep the picture's colours instead of the site's greyscale).
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
          body: "Remove. Open. Plant. Connect. The design starts by subtracting: removing low floor plates, opening the canal-facing side and filtering western light through a jaali. Beneath the viaduct, a planted structural framework makes a shaded public route. Reuse before replacement: the existing concrete viaduct, an inserted structural framework and a planted public edge, in a repeatable module designed to extend along the viaduct.",
          image: "assets/images/work/project-01/panel-02.webp",
          alt: "Exploded isometric drawing of the station in layers, with an inserted framework in dark lines beside pale floor plans and a grey diagonal band.",
          ratio: 0.443
        },
        {
          heading: "reclaiming the station's volume",
          body: "Opening the existing structure to light and public occupation. Removing the low intermediate floor plates opens up a generous vertical volume inside the station.",
          image: "assets/images/work/project-01/panel-03.webp",
          alt: "Long section drawn in fine lines: the station on the left and the planted viaduct running to the right, with trees along the whole length.",
          ratio: 9.023
        },
        {
          heading: "making the ground level active",
          body: "Shops, food court and a shaded canal-side walkway. The shopping complex and food court connect the residential area, the IT corridor and the canal edge.",
          image: "assets/images/work/project-01/panel-04.webp",
          alt: "Plinth-level plan along the canal edge: the station hall with its column grid on the left, then rows of shops and a food court, the canal band, trees and housing blocks below.",
          ratio: 5.15
        },
        {
          heading: "through the station",
          body: "More height and a more open interior. At ground level, restaurants and cafés line the long edges while the central axis is kept clear for circulation.",
          image: "assets/images/work/project-01/panel-05.webp",
          alt: "Cross-section through the station: a pitched roof over a tall central volume, staircases on both sides, and trees at either end.",
          ratio: 3.902
        },
        {
          heading: "towards the canal",
          body: "A new relationship with the water's edge. The section runs from the road and a raised walkway, across the framed building, to the canal.",
          image: "assets/images/work/project-01/panel-06.webp",
          alt: "Cross-section towards the canal: a long walkway on a viaduct at the left, a two-storey frame with a balcony in the middle, and the canal cut into the ground at the right, with trees.",
          ratio: 4.651
        },
        {
          heading: "designing the pause",
          body: "Stillness is translated into four spatial cues rather than a single quiet room: framed views, filtered light, transparent edges and planting offer moments to notice, reorient and stay, while circulation continues around them. Inside, a public room: reclaimed volume, everyday activity and places to linger. Vegetation and porous screens are intended to temper dust, noise and heat while admitting daylight and air.",
          image: "assets/images/work/project-01/panel-07.webp",
          alt: "Render of the opened-up station interior: tall concrete columns, galleries with railings, a timber floor, planters with young trees and a person sitting on a bench.",
          ratio: 1.414
        },
        {
          heading: "a different commute",
          body: "One journey, eight moments. A storyboard of a familiar commute tests how a station offering shade, views and places to sit could change the journey from a route to an experience. The proposal imagines a planted, shaded route beside the station, and public space beyond transit: a place to gather, rest and remain. In the midst of chaos, a place to pause.",
          image: "assets/images/work/project-01/panel-08.webp",
          alt: "Eight storyboard frames in a staggered row, following one commute from a street and a station stair through a creeper-covered walkway and interiors to the platform and benches under trees.",
          ratio: 5.298
        },
        {
          heading: "plan with the five render views",
          body: "The five render views gathered on one plan strip: the shaded walkway, the canal promenade, the canal edge and bridge, the public space under the viaduct and the station interior.",
          image: "assets/images/work/project-01/panel-09.webp",
          alt: "A strip of plan blocks and trees along the canal edge with five round render views set on it: a trussed walkway, a promenade, the canal and bridge, a public space under the viaduct and the station interior.",
          ratio: 5.854
        },
        {
          heading: "movement with room to linger",
          body: "A planted, shaded route beside the station. A structural framework supports creepers and hanging planters, making a shaded canopy that keeps the space open and breathable.",
          image: "assets/images/work/project-01/panel-10.webp",
          alt: "Render of a walkway under a braced framework covered with creepers, with dappled shade on the paving and two people walking along it.",
          ratio: 1.414
        },
        {
          heading: "the canal promenade",
          body: "A canal-side promenade with seating. Active frontages along the viaduct turn everyday acts, like grabbing a snack or waiting for a train, into chances for lingering and interaction.",
          image: "assets/images/work/project-01/panel-11.webp",
          alt: "Render of a canal-side promenade at sunset: paving with hexagonal planters and benches, a footbridge on the left and a planted framework on the right.",
          ratio: 1.414
        },
        {
          heading: "public space beyond transit",
          body: "A place to gather, rest and remain. Under the viaduct, the framework turns leftover infrastructure into a usable public room with stairs and shops.",
          image: "assets/images/work/project-01/panel-12.webp",
          alt: "Render of a public space under the viaduct: a paved court dappled with shade, a stair rising on the left, shopfronts in the middle and hanging creepers overhead.",
          ratio: 1.414
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
          alt: "Hand-drawn sheet with four ways of keeping research across the top, from loose clutter to a three-dimensional workspace, and ten spatial studies below, with the workspace and study 7 outlined.",
          ratio: 1.302
        },
        {
          heading: "the chosen field",
          body: "Study 7, built as the landing field: white points on black, glowing faintly where the pointer rests.",
          image: "assets/images/work/project-02/panel-03.webp",
          alt: "The landing page: a near-black screen with a regular field of white points, a small cluster glowing at one side and the words start with an idea in the centre.",
          ratio: 1.6
        },
        {
          heading: "placing, grouping, connecting",
          body: "In the first build the workspace had depth but behaved like a flat board. Items now sit on layers and can be pushed back or brought forward, and tilting the camera shows how they relate. Three actions organise the material: place an item, move related items together to form a group, and tie a thread to make a link explicit.",
          image: "assets/images/work/project-02/panel-04.webp",
          alt: "Hand-drawn sequence in three steps: place assets in the workspace, move them closer to form groups, then connect them with threads to form relationships.",
          ratio: 1.762
        },
        {
          heading: "workspace behaviour",
          body: "Assets enter the archive, form groups and connect across them. The drawing runs from product to projects, to assets in 2D and 3D, to connections and organisation.",
          image: "assets/images/work/project-02/panel-05.webp",
          alt: "Hand-drawn diagram of a spatial archive holding three groups of items tied by red threads, above a row running from product to projects, assets and connections.",
          ratio: 1.377
        },
        {
          heading: "2d and 3d workspace",
          body: "A 2D workspace works only along the X and Y axes, width and height. A 3D workspace also works along Z, depth.",
          image: "assets/images/work/project-02/panel-06.webp",
          alt: "Hand-drawn comparison of a flat workspace with X and Y axes and a three-dimensional workspace with X, Y and Z axes, each holding a few items.",
          ratio: 1.515
        },
        {
          heading: "depth layers",
          body: "The same view, before and after an item is pushed back one layer. The apartment images are sample material.",
          image: "assets/images/work/project-02/panel-07.webp",
          alt: "Two screenshots of the same view, before and after one picture is pushed back a layer in the workspace (sample apartment material).",
          ratio: 3.167
        },
        {
          heading: "overall user flow",
          body: "From opening the site to a project workspace: open site, landing, enter the archive, project, select or create projects, then the project workspace.",
          image: "assets/images/work/project-02/panel-08.webp",
          alt: "Hand-drawn row of six screens, from opening the site through the landing field and the projects page to a project workspace.",
          ratio: 2.846
        },
        {
          heading: "camera and navigation model",
          body: "Pan, tilt, forward zoom and recentre. Pan looks left or right, tilt looks up or down, forward zoom moves into the archive, and recentre returns to the centre before a transition.",
          image: "assets/images/work/project-02/panel-09.webp",
          alt: "Hand-drawn diagram of the camera: three steps of recentring and zooming in, a key to pan, tilt, zoom and recentre, and a camera inside a field of dots.",
          ratio: 1.514
        },
        {
          heading: "drawn first, then built",
          body: "Transitions were planned as storyboards before they were coded. An abrupt switch between screens would break the sense of moving through one space. When a project opens, the selected card breaks into particles, a floor forms and the material settles into place. Search follows the same logic: the camera travels to the result instead of jumping to it.",
          image: "assets/images/work/project-02/panel-10.webp",
          alt: "Hand-drawn storyboard of twelve frames showing a project card breaking into dots, a floor appearing and the material settling into the workspace.",
          ratio: 1.333
        },
        {
          heading: "landing page behaviour",
          body: "Five stages, from an empty screen to the starting field: empty, dots appear, field forms, gentle sway, inviting.",
          image: "assets/images/work/project-02/panel-11.webp",
          alt: "Hand-drawn strip of five browser windows, from an empty page to a field of blue dots with the words start with an idea.",
          ratio: 2.709
        },
        {
          heading: "landing to projects, sketched",
          body: "Interface elements emerge from the navigated space: the landing page recentres and zooms, panels emerge and expand, and the projects resolve.",
          image: "assets/images/work/project-02/panel-12.webp",
          alt: "Hand-drawn strip of six frames moving from the dotted landing field to a grid of project tiles.",
          ratio: 2.284
        },
        {
          heading: "landing to projects, built",
          body: "Recentre, then the projects resolve. The project names shown are sample material.",
          image: "assets/images/work/project-02/panel-13.webp",
          alt: "Two screens of the built transition: the dotted landing field recentring, then a grid of project tiles resolving (sample project names).",
          ratio: 4.04
        },
        {
          heading: "project entry, built",
          body: "Disintegrate, swirl, burst, floor, materialise: the selected card breaks into dust, a floor forms and the material settles into place. The projects and images shown are sample material.",
          image: "assets/images/work/project-02/panel-14.webp",
          alt: "Six frames of the built project entry: a card dissolving into dust, a swirl, a burst, a field of dots, a floor with footprints and the workspace materialising (sample material).",
          ratio: 2.652
        },
        {
          heading: "search",
          body: "The camera travels to the matching item. Four frames: the word typed, two in flight, and the view settled on the match. The images shown are sample material.",
          image: "assets/images/work/project-02/panel-15.webp",
          alt: "Four screenshots of search: the word render typed, two frames of the view gliding towards a match, and the view arriving at an apartment render (sample material).",
          ratio: 1.593
        },
        {
          heading: "looking closely",
          body: "An image opened in the focus view, with its title, tags and notes. The masterplan shown is sample material.",
          image: "assets/images/work/project-02/panel-16.webp",
          alt: "The focus view: a masterplan drawing opened large beside a small panel with its title, tags and notes (sample material).",
          ratio: 1.894
        },
        {
          heading: "a model, close",
          body: "A massing model turned in the focus view. Three-dimensional material can be opened, rotated and inspected on its own. The model shown is sample material.",
          image: "assets/images/work/project-02/panel-17.webp",
          alt: "The focus view for a 3D model: a white massing model on a dark ground beside a small panel with its title, tags and notes (sample material).",
          ratio: 1.894
        },
        {
          heading: "the archive in use",
          body: "Images, PDFs, notes, drawings and 3D models share one workspace. A drawing can sit above the model it belongs to, and items open in a focus view and keep their position between sessions. It has not yet been formally tested with other people. The next step is a short think-aloud study, to see whether arranging research spatially helps people find connections. Where something sits can say what it means.",
          image: "assets/images/work/project-02/panel-18.webp",
          alt: "A flat drawing of a building massing floating above the matching white 3D massing model in the dark workspace, with a thin thread running between them (sample material).",
          ratio: 1.75
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
          body: "The street is invented, a composite inspired by Ambattur, on Chennai's western edge. A maintained promenade and storm drain line the lake. Around the corner the paving stops: fourteen houses face a narrow lane that sits lower than the road, so the water the drain cannot take collects there. The street was modelled to scale from a dimensioned plan, so every level, puddle and doorstep follows from it.",
          image: "assets/images/work/project-03/panel-02.webp",
          alt: "A rendered view along a lakeside road in evening light: railings and trees beside the lake on the left, an auto-rickshaw ahead, and a paved footpath with a drain grate on the right.",
          ratio: 1.777
        },
        {
          heading: "lakefront and lane",
          body: "What the city provides, and what residents do instead. Along the lakefront, municipal workers sweep and clear the drains. In the lane, residents sweep, wade, and lift their things onto high shelves.",
          image: "assets/images/work/project-03/panel-03.webp",
          alt: "A two-part section diagram: the lakefront on the left with a shade tree, solar street light, bench and trench drain, and the lane on the right with a house in section, standing water, a raised plinth and a high shelf, above a table comparing what each side has.",
          ratio: 1.822,
          colour: true
        },
        {
          heading: "ground profile",
          body: "From the promenade down to the lane. The lane falls below the road, so standing water up to 14 cm deep collects at its lowest point. The profile is drawn with the vertical scale exaggerated eleven times.",
          image: "assets/images/work/project-03/panel-04.webp",
          alt: "A long section from the lake on the left, rising to the promenade, dipping to the road and footpath, then sloping down into the lane, where a pale band of standing water sits above the lowest point.",
          ratio: 4.554
        },
        {
          heading: "first camera plan",
          body: "The brief began as ten shot stations along the lakefront road and the lane, with arrows for the viewer's movement. The final plan is one continuous walk with seven stills.",
          image: "assets/images/work/project-03/panel-05.webp",
          alt: "A plan of the lake edge, promenade, road and footpath beside fourteen numbered lots along the lane, with ten numbered shot stations and arrows showing the viewer's movement.",
          ratio: 1.418
        },
        {
          heading: "camera path",
          body: "One take, seven stills. The line is the camera path for the whole take; each numbered station is a still, drawn with its field of view. The plan also marks the standing water and the plank walkway.",
          image: "assets/images/work/project-03/panel-06.webp",
          alt: "A plan of the promenade, road and footpath and the lane between fourteen lots, with a red camera path turning from the road into the lane, seven numbered stations with fields of view, a pale band of standing water and a plank walkway.",
          ratio: 2.075,
          colour: true
        },
        {
          heading: "building the world",
          body: "The street was blocked out in SketchUp from the plan and refined over thirteen passes with a fixed camera, so each change could be judged in the same view. In Unreal Engine the work moved to surfaces: worn plaster, wet floors, patched doors. Choices such as which paint had faded, or how high the water stains reach, were compared side by side.",
          image: "assets/images/work/project-03/panel-07.webp",
          alt: "A strip of thirteen lane-entry views from the same camera in two rows, labelled Pass 1 to Pass 13, from a bare SketchUp blockout to the finished model with overhead cables and drums.",
          ratio: 5.096
        },
        {
          heading: "lane elevations",
          body: "Fourteen houses, each adapted differently. The north and south frontages are drawn with lot numbers, heights and the hero buildings. They are design intent, not construction drawings.",
          image: "assets/images/work/project-03/panel-08.webp",
          alt: "Two rows of colourful house elevations, the north frontage above and the south frontage below, each lot labelled and drawn at its own height with doors and windows.",
          ratio: 2.028
        },
        {
          heading: "stage by stage",
          body: "SketchUp blockout, SketchUp dressed, Unreal import, Unreal clay, first materials, Unreal weathered. In Unreal Engine the work moved to surfaces: worn plaster, wet floors, patched doors.",
          image: "assets/images/work/project-03/panel-09.webp",
          alt: "Six views of the lane in a grid: a dark SketchUp blockout, a dressed SketchUp view, then Unreal renders with imported SketchUp colours, grey clay, first materials and finally weathered plaster with wet floors.",
          ratio: 2.664
        },
        {
          heading: "surface palettes",
          body: "Two options for the same wall. Choices such as which paint had faded, or how high the water stains reach, were compared side by side.",
          image: "assets/images/work/project-03/panel-10.webp",
          alt: "A board comparing two surface palettes on the same two views: a richer Chennai colour with tactile paint on the left and a muted, more weathered palette on the right.",
          ratio: 1.67,
          colour: true
        },
        {
          heading: "the drain, before and after",
          body: "The drain before it was reworked, left, and in the final still, right. The lane sits lower than the road, so the water the drain cannot take collects there.",
          image: "assets/images/work/project-03/panel-11.webp",
          alt: "Two views of the lane drain side by side: an earlier render on the left and the finished backlit still on the right, with a gushing spout and a leaf-strewn puddle.",
          ratio: 3.577
        },
        {
          heading: "light tells the story",
          body: "An overcast morning made the lane flat; a low evening sun gave it structure. On the lakefront the sky is open and the light is even. In the lane the sky narrows to a strip, so light arrives in pools on the tea-stall step, the planks and a doorway. Every version was checked in grey values before colour. The light changes with the place, not the time.",
          image: "assets/images/work/project-03/panel-12.webp",
          alt: "A dark plan of the lane showing where each pool of light comes from: the lane-mouth pool, tea-stall tube and step, planks, far lane and home bulbs, with low sun arriving from the lake.",
          ratio: 4.678
        },
        {
          heading: "overcast morning",
          body: "Same camera, two lighting options. An overcast morning made the lane flat. Lit like a grey morning, the lane said nothing.",
          image: "assets/images/work/project-03/panel-13.webp",
          alt: "The lane entry under a flat overcast sky: teal and white plastered walls, wet ground and a pale sky, with little contrast between light and shade.",
          ratio: 1.778
        },
        {
          heading: "golden evening",
          body: "Same camera, a low evening sun. A low evening sun gave the lane structure. In the lane the sky narrows to a strip, so light arrives in pools, with cool shadow between.",
          image: "assets/images/work/project-03/panel-14.webp",
          alt: "The same lane entry in low evening sun: long diagonal shadows across the teal wall and bright reflections on the wet ground.",
          ratio: 1.778
        },
        {
          heading: "lighting rounds",
          body: "Round 4, built on the depth version: a refined version, a warm palette and a cool palette, each across four shots. Each round changed one idea at a time and was checked as a value study first.",
          image: "assets/images/work/project-03/panel-15.webp",
          alt: "A board of sixteen small frames in four rows: the promenade, lane mouth, planks and view back under four lighting versions labelled depth, refined, warm and cool.",
          ratio: 1.556
        },
        {
          heading: "locking the look",
          body: "Three versions across every shot: FINAL4, FINAL6 (the middle ground) and FINAL5. The look was locked on FINAL6.",
          image: "assets/images/work/project-03/panel-16.webp",
          alt: "A tall board comparing three lighting versions, FINAL4, FINAL6 and FINAL5, side by side for each of seven shots, from the lane mouth to home.",
          ratio: 0.678,
          colour: true
        },
        {
          heading: "value study",
          body: "The drain in grey values. Every version was checked in grey values before colour.",
          image: "assets/images/work/project-03/panel-17.webp",
          alt: "A posterised study of the backlit drain in a few flat grey values, with bright floor patches and dark shapes where the drain and its step stand.",
          ratio: 1.778
        },
        {
          heading: "colour script",
          body: "The walk in seven frames. Each is a blurred key of one still, so only colour and light remain.",
          image: "assets/images/work/project-03/panel-18.webp",
          alt: "Seven blurred colour frames in two rows, one for each still along the walk, from the pale promenade through the dark lane to the bright view back.",
          ratio: 3.623,
          colour: true
        },
        {
          heading: "value along the walk",
          body: "Bright lakefront, dark lane, lighter at the end: an open lakefront, a backlit peak at the drain, the lane sinking into shadow, light returning at the far end.",
          image: "assets/images/work/project-03/panel-19.webp",
          alt: "A line graph of average value along the walk across seven stills: 38 percent on the lakefront, a peak of 42 percent at the drain, a fall to 18 percent in the lane and a rise to 25 percent at the far end.",
          ratio: 14.815
        },
        {
          heading: "a lane that is lived in",
          body: "The lane is poorer than the lakefront but more alive, and the everyday work of coping says more than distress would: sweeping water back to the drain, wading with a bag held clear, lifting boxes to a high shelf.",
          image: "assets/images/work/project-03/panel-20.webp",
          alt: "A rendered view along a flooded lane: a yellow bicycle in the foreground, planks laid across the water as stepping stones, and washing hung across the far end.",
          ratio: 1.777
        },
        {
          heading: "the drain",
          body: "Overflow, backlit against the low sun. The lane sits lower than the road, so the water the drain cannot take collects there.",
          image: "assets/images/work/project-03/panel-21.webp",
          alt: "A low, backlit view of a drain spout gushing into a leaf-strewn puddle beside a stepped plinth, with dappled sunlight across a plaster wall.",
          ratio: 1.777
        },
        {
          heading: "deep in the lane",
          body: "Light arrives only in pools. In the lane the sky narrows to a strip, with cool shadow between the pools on the tea-stall step, the planks and a doorway.",
          image: "assets/images/work/project-03/panel-22.webp",
          alt: "A view deep into the flooded lane: a yellow bicycle against the left wall, planks and stepping stones across the water, and washing hung at the far end.",
          ratio: 1.777
        },
        {
          heading: "home",
          body: "Belongings lifted to the high shelf. The everyday work of coping says more than distress would.",
          image: "assets/images/work/project-03/panel-23.webp",
          alt: "A view through a doorway into a small plastered room with peeling walls, a high shelf of steel vessels, a gas cylinder and a low table on a damp floor.",
          ratio: 1.777
        },
        {
          heading: "looking back",
          body: "Both places in one frame. The flooded lane runs back to the bright lakefront where the walk began.",
          image: "assets/images/work/project-03/panel-24.webp",
          alt: "A view back up the lane towards the bright lakefront, with sunlit balconies, wet ground reflecting the light, and a tree and railing at the far end.",
          ratio: 1.777
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
          body: "The original studio project: an IT office campus on Chennai's OMR, a group project by a team of 2 in the sixth-semester studio. Staggered volumes are arranged around a central courtyard.",
          image: "assets/images/work/project-04/panel-02.webp",
          alt: "Aerial perspective of the office campus: stepped pale volumes around a central courtyard, with a gravel garden in front.",
          ratio: 1.587
        },
        {
          heading: "the massing sketch",
          body: "Massing sketch from the studio project, 2025. The labels name the vertical louvres used for façade treatment, the jaali, glazing, solar panels, exposed brick, and the roof-top recreation and green roof.",
          image: "assets/images/work/project-04/panel-03.webp",
          alt: "Hand-drawn massing sketch of the campus with labelled louvres, jaali, glazing, solar panels, shear walls and parking.",
          ratio: 2.817
        },
        {
          heading: "raumplan sketch",
          body: "Volumes of different heights. The building plays with levels, so the space above you changes: more height means more importance.",
          image: "assets/images/work/project-04/panel-04.webp",
          alt: "Sketch of stacked and scattered boxes of different heights, drawn to show volumes at different levels.",
          ratio: 1.175
        },
        {
          heading: "plinth level plan",
          body: "Ground floor, around the central courtyard. The courtyard-facing façades are the ones selected for study.",
          image: "assets/images/work/project-04/panel-05.webp",
          alt: "Plan of the plinth level, with offices and open work areas wrapped around a courtyard planted with a large tree, on a walled site beside a road.",
          ratio: 1.318
        },
        {
          heading: "floor plans, levels 1 to 5",
          body: "Levels 1 to 5 of the studio project, in order. The floor plates change shape from level to level around the courtyard.",
          image: "assets/images/work/project-04/panel-06.webp",
          alt: "Five floor plans of the campus, levels 1 to 5, in two rows, each showing the building wrapped around the courtyard.",
          ratio: 1.975
        },
        {
          heading: "front and right elevations",
          body: "Front elevation (top) and right elevation (bottom) from the studio project, 2025.",
          image: "assets/images/work/project-04/panel-07.webp",
          alt: "Two soft watercolour elevations of the campus, the front elevation above and the right elevation below, each standing on a ground line.",
          ratio: 1.35
        },
        {
          heading: "perspective section",
          body: "A perspective section through the building from the studio project: floor plates at different levels, with spaces of one, two and three storeys.",
          image: "assets/images/work/project-04/panel-08.webp",
          alt: "Perspective section through the building showing floor plates at different levels, a tall lattice-fronted volume and trees on either side.",
          ratio: 3.019
        },
        {
          heading: "the fins follow the floors",
          body: "The building steps between 3 m spaces for individual work, 6 m volumes for collaboration and 9 m shared spaces. The original fins follow the first storey of each volume, screening the occupied eye-level glazing while keeping the glass above clear for daylight. Traced against the model, the rule holds across approximately 99% of the courtyard glazing. Whether it also gave effective solar protection was still unknown.",
          image: "assets/images/work/project-04/panel-09.webp",
          alt: "View across the courtyard corner of the original building, with horizontal bands of vertical fins at different storeys and clear glass between and above them.",
          ratio: 1.5
        },
        {
          heading: "the rule behind the fins",
          body: "Each floor gets fins along its first 3 m, so there is no harsh sun at eye level. In the taller spaces, light comes in high, through the clear glass above. More height, more importance.",
          image: "assets/images/work/project-04/panel-10.webp",
          alt: "Three section diagrams of a one, two and three storey space, each with fins on the lowest 3 m, figures at eye level and sun rays stopped by the fins.",
          ratio: 2.849
        },
        {
          heading: "the result on the courtyard",
          body: "The floors sit at different levels, so the fins do too, and you can read the section from the courtyard. Checked against the floor slabs in the Revit model, the fin bands follow the floor plates along 99% of the courtyard glass.",
          image: "assets/images/work/project-04/panel-11.webp",
          alt: "Unfolded elevation of the west and north wings showing the original fins, floor plates and the 6 m and 9 m spaces.",
          ratio: 3.527
        },
        {
          heading: "reading chennai's sun",
          body: "The façade was tested against a year of Chennai's sun, with the building set to true north. The analysis drew attention to a problem the original pattern did not reveal: low-angle morning sunlight striking the east-facing courtyard glass. The identical fins performed unevenly across the two wings, blocking roughly two-thirds of direct sun on one façade but less than half on the other. One fin, two very different results.",
          image: "assets/images/work/project-04/panel-12.webp",
          alt: "Polar sun path diagram for Chennai, with a figure-of-eight loop for each daylight hour of the year and arcs for the solstices and equinox.",
          ratio: 1.106,
          colour: true
        },
        {
          heading: "temperature and humidity",
          body: "Month by month, the range and the mean. Chennai is hot and humid all year, with the sun almost overhead.",
          image: "assets/images/work/project-04/panel-13.webp",
          alt: "Two charts: the monthly range and mean of dry-bulb temperature, and monthly relative humidity bars.",
          ratio: 2.506
        },
        {
          heading: "sun on each orientation",
          body: "Direct beam and diffuse sky over a year, on a vertical surface facing each direction.",
          image: "assets/images/work/project-04/panel-14.webp",
          alt: "Radial bar chart of annual direct-beam and diffuse sun on vertical surfaces facing sixteen directions, with the values around the edge.",
          ratio: 1.095
        },
        {
          heading: "same louvre, different job",
          body: "Direct sun on the glass behind the fins, with and without them, storey by storey. The same louvre keeps out about two-thirds of the direct sun on one façade and less than half on the other.",
          image: "assets/images/work/project-04/panel-15.webp",
          alt: "Paired bar charts for the north wing and the west wing comparing direct sun on the glass with the fins removed and with the original fins, storey by storey.",
          ratio: 2.204
        },
        {
          heading: "from data to a moving fin",
          body: "Static variations in fin depth and spacing helped only modestly. Rather than replace the courtyard pattern, I retained the original fin bays and explored movement as the new variable. In Grasshopper, climate inputs, geometric limits and solar-response rules informed the blade configuration and hourly angles of independently controlled six-metre zones. The façade did not need a new visual language. It needed a new way to react to the sun.",
          image: "assets/images/work/project-04/panel-16.webp",
          alt: "The Grasshopper definition: a long canvas of linked components that takes the façade model and the measured sun and ends in blade geometry, angles and exports.",
          ratio: 3.175
        },
        {
          heading: "from climate to selection",
          body: "Every geometric decision traced to a measured cause: inputs, measured exposure, rules, geometry, evaluation, kinetic control, comparison and selection.",
          image: "assets/images/work/project-04/panel-17.webp",
          alt: "Flow diagram of eight boxes in two rows, from inputs and measured exposure through rules, geometry and evaluation to kinetic control, comparison and refinement.",
          ratio: 2.814
        },
        {
          heading: "original fin zones, kept",
          body: "The original fin rhythm is retained and grouped into independently controlled six-metre zones. The north wing (SSW) is above and the west wing (ESE) below.",
          image: "assets/images/work/project-04/panel-18.webp",
          alt: "Two elevation diagrams, north wing above and west wing below, with the original fin bays hatched, glass, solid walls and piers shaded, and one six-metre control zone boxed.",
          ratio: 1.905
        },
        {
          heading: "thirty fixed options",
          body: "Thirty fixed options for the north wing (SSW): direct sun on the glass against view openness. Only the deepest and densest beat the original fins, by 5 to 15%, and they use more material and block more view.",
          image: "assets/images/work/project-04/panel-19.webp",
          alt: "Scatter plot of thirty fixed fin options, direct sun on the glass on the vertical axis and view openness on the horizontal axis, with a dashed line for the original fins.",
          ratio: 1.592,
          colour: true
        },
        {
          heading: "one zone, five states",
          body: "One control zone across its rotation range, 60 degrees either side of open. The same 400 mm fin in five states: closed against low sun from one side, partial block, open and parked, partial block, closed from the other side.",
          image: "assets/images/work/project-04/panel-20.webp",
          alt: "Five renders of one control zone of vertical blades, from closed at one side through open to closed at the other, labelled with their angles.",
          ratio: 6.316
        },
        {
          heading: "the fin, resolved and tested",
          body: "The original fin zones are preserved, each six-metre bay turning its blades together on one actuator, with a fail-safe open position. Simulated for occupied hours, direct-beam exposure behind the fins falls 24% on the SSW façade and 35% on the ESE façade against the original, with daylight maintained. A simulated design improvement, not a verified operational-energy saving. The fins still follow the floors; their angles now follow the sun.",
          image: "assets/images/work/project-04/panel-21.webp",
          alt: "Exploded view of one control zone: a slab edge and glass wall, bracket arms and a tie-bar, and a row of tall blades pulled out in front with their shadows on the ground.",
          ratio: 1.378
        },
        {
          heading: "exploded axonometric of one zone",
          body: "One kinetic control zone, one storey by one 6 m bay, exploded along the façade normal: existing curtain wall, slab-edge brackets and bearings, tie-bar and crank arms, one linear actuator and the blades. Preliminary design development, not for fabrication.",
          image: "assets/images/work/project-04/panel-22.webp",
          alt: "Line drawing of one control zone exploded into layers: slab edge and curtain wall, brackets and bearings, a tie-bar and actuator, and a row of blades, with numbered labels.",
          ratio: 1.584
        },
        {
          heading: "close-up of the linked blades",
          body: "Linked blades and actuators: hollow aluminium aerofoils on stainless pivot shafts, carried by bracket arms at the slab edge, so no load reaches the glazing. Preliminary design development, not engineered.",
          image: "assets/images/work/project-04/panel-23.webp",
          alt: "Close render of a row of tall pale blades on pivot shafts in front of a glass wall, with the brackets and crank arms below, cut away at 1.1 m.",
          ratio: 1.499
        },
        {
          heading: "a day of the blades",
          body: "The same blades through one day, 21 April: 07:00, 09:00, 11:00, 13:00, 15:00 and 17:00, with the time and sun position under each frame. Each zone turns on its own schedule.",
          image: "assets/images/work/project-04/panel-24.webp",
          alt: "Six close views of the same band of blades at 07:00, 09:00, 11:00, 13:00, 15:00 and 17:00 on 21 April, each captioned with the time and sun position.",
          ratio: 2.395
        },
        {
          heading: "sun and shadow at 09:00",
          body: "The west wing (ESE) at 09:00 on 21 March, with the real shadows of the blades: the original fixed fins on the left, the same fins made kinetic on the right.",
          image: "assets/images/work/project-04/panel-25.webp",
          alt: "Two renders side by side of the same courtyard façade in morning sun: original fins on the left, kinetic blades turned at an angle on the right.",
          ratio: 3.023
        },
        {
          heading: "close view, north wing",
          body: "The blade rhythm and depth on the north wing (SSW) at 15:30 on 21 March: the original fixed fins on the left, the same fins made kinetic on the right.",
          image: "assets/images/work/project-04/panel-26.webp",
          alt: "Two renders side by side of a band of fins seen in perspective: the original fins on the left and the kinetic blades, turned at different angles, on the right.",
          ratio: 3.023
        },
        {
          heading: "view from inside",
          body: "From an upper office floor, 3 m from the glass, looking out across the courtyard at 14:00 on 21 December: the original fixed fins on the left, the kinetic blades on the right.",
          image: "assets/images/work/project-04/panel-27.webp",
          alt: "Two renders side by side from inside an office looking out through glass to the courtyard, original fins on the left and kinetic blades on the right.",
          ratio: 3.023
        },
        {
          heading: "performance summary",
          body: "The original fin made kinetic against the original fixed fins, behind the fin bays. Direct sun is 24% less (north wing) and 35% less (west wing); total solar 3% and 17% less; daylight (sDA300) 46% and 47%. Solar and daylight simulations only.",
          image: "assets/images/work/project-04/panel-28.webp",
          alt: "A table of big figures for each wing: direct sun on the glass, total solar, direct-sun hours, view openness and daylight, with a footnote on the method.",
          ratio: 2.022
        },
        {
          heading: "change in direct sun on glass",
          body: "Final design minus original fins: blue marks less sun, red more. Averaged over each whole elevation it is about 12% less (north wing) and 13% less (west wing); behind the fin bays the reductions are 24% and 35%.",
          image: "assets/images/work/project-04/panel-29.webp",
          alt: "Two maps of the north and west elevations, each patch of glass coloured by the change in direct sun from the original fins to the final design, mostly blue for less sun.",
          ratio: 1.731,
          colour: true
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
          heading: "first design",
          body: "Revit model of the original scheme. The initial design uses glass treads supported by a curved steel spine, forming a semicircular stair with an open appearance.",
          image: "assets/images/work/project-05/panel-02.webp",
          alt: "Line drawing of the first Revit design: glass treads stepping up along a curved spine, with the outline of the glass balustrade above.",
          ratio: 1.618
        },
        {
          heading: "physical model",
          body: "A physical model, built by hand. It helped establish the module arrangement, followed by structural analysis and revisions.",
          image: "assets/images/work/project-05/panel-03.webp",
          alt: "Low view of a hand-built model: clear treads on dark frames with thin clear posts, a white card base and a landing block.",
          ratio: 0.781
        },
        {
          heading: "a repeated tread module",
          body: "The stair contains twenty repeated tread assemblies around a curved steel spine. Each assembly uses steel rods to support a glass tread at four points. The spine forms a half-circle and tapers along its length. The module layout was developed through physical and digital models.",
          image: "assets/images/work/project-05/panel-04.webp",
          alt: "Top view of the hand-built model: black rods fanning around a half circle on a white card base, one rod frame for each tread.",
          ratio: 1.421
        },
        {
          heading: "module rhythm",
          body: "The same module, rotated step by step. The stair contains twenty repeated tread assemblies around a curved steel spine.",
          image: "assets/images/work/project-05/panel-05.webp",
          alt: "Close view of the dark steel spine with the repeated rod frames and glass treads stepping along it.",
          ratio: 1.5
        },
        {
          heading: "module, exploded",
          body: "Rods, node block, bearings and glass tread. Each assembly uses steel rods to support a glass tread at four points.",
          image: "assets/images/work/project-05/panel-06.webp",
          alt: "Exploded view of one module: a glass tread lifted above a dark node block, steel rods and four bearing discs.",
          ratio: 0.923
        },
        {
          heading: "plan",
          body: "Half a circle, two metres from the centre. The module layout was developed through physical and digital models.",
          image: "assets/images/work/project-05/panel-07.webp",
          alt: "Plan of the half-circle stair showing the twenty tread modules around the spine, with the section marks and a scale bar.",
          ratio: 1.627
        },
        {
          heading: "elevation",
          body: "The stair in elevation. The spine forms a half-circle and tapers along its length.",
          image: "assets/images/work/project-05/panel-08.webp",
          alt: "Elevation of the stair: the curved spine rising from the floor to the landing, with the rod frames, glass treads and balustrade outline along it.",
          ratio: 1.495
        },
        {
          heading: "section",
          body: "Where a tread meets the spine. Each assembly uses steel rods to support a glass tread at four points.",
          image: "assets/images/work/project-05/panel-09.webp",
          alt: "Section through one typical module: the spine plate, the rod frame and the glass tread with its balustrade posts.",
          ratio: 1.203
        },
        {
          heading: "tracing the load path",
          body: "The Revit geometry was transferred into Robot Structural Analysis, allowing the same model to be checked without rebuilding it. Load-path studies followed forces from the tread through the rods and spine. Initial checks showed overstressed members, particularly in the slender rods supporting the glass corners.",
          image: "assets/images/work/project-05/panel-10.webp",
          alt: "Drawing of the load path through one tread: a 4.5 kN load at the glass edge passing through the bearings and rods into the spine plate, with numbered notes and a whole-stair inset.",
          ratio: 1.565,
          colour: true
        },
        {
          heading: "model to analysis",
          body: "The workflow, step by step. Every number in the analysis comes from the Revit model: no geometry was retyped.",
          image: "assets/images/work/project-05/panel-11.webp",
          alt: "Diagram of eight scripted steps from the Revit model to a checked structure, with the model, the analytical model and the member utilisation result below.",
          ratio: 2.003
        },
        {
          heading: "tension and compression",
          body: "How each module carries its tread. Left: one module under a 4.5 kN point load. Right: the whole stair under a full crowd load.",
          image: "assets/images/work/project-05/panel-12.webp",
          alt: "Two force diagrams: one module under a 4.5 kN point load, and the whole stair under a full crowd load, with tension in blue and compression in red.",
          ratio: 1.554,
          colour: true
        },
        {
          heading: "deformation",
          body: "Movement under a full crowd load, shown as a colour map. The largest is 4.1 mm, on the outer glass; the spine moves 2.6 mm, against a limit of 19.1 mm.",
          image: "assets/images/work/project-05/panel-13.webp",
          alt: "Colour map of the stair seen from above, showing how much each part moves under a full crowd load, from blue (least) to red (most).",
          ratio: 1.645,
          colour: true
        },
        {
          heading: "first model and final",
          body: "Same form, same loads, same scale. Initial checks showed overstressed members, particularly in the slender rods supporting the glass corners.",
          image: "assets/images/work/project-05/panel-14.webp",
          alt: "Two plots of member utilisation under the same loads, the first model with many failing members in red and the final design with none, with a table of results below.",
          ratio: 2.22,
          colour: true
        },
        {
          heading: "revising the structure",
          body: "Several structural options were compared while retaining the semicircular form. Thickening the spine and adding supports beneath the stair were not taken forward. The revised scheme uses larger rods where needed, welded module connections and glass balustrades that contribute to stability. All 185 members that initially failed the modelled strength checks passed in the revised analysis.",
          image: "assets/images/work/project-05/panel-15.webp",
          alt: "Revit view of the stair with rod tripods propping the spine from below, one of the options that was not taken forward.",
          ratio: 1.323
        },
        {
          heading: "spine sections",
          body: "Options compared at the same scale. Thickening the spine and adding supports beneath the stair were not taken forward.",
          image: "assets/images/work/project-05/panel-16.webp",
          alt: "Seven spine cross-sections drawn to scale as bars for the base and the top, from the 30 mm original to the 45 mm option and two split spines.",
          ratio: 2.913
        },
        {
          heading: "structural glass",
          body: "The glass balustrade became part of the structure. Revit shows the glass as solid grey.",
          image: "assets/images/work/project-05/panel-17.webp",
          alt: "Revit view of the stair with the two glass balustrade ribbons, shown solid grey, running above the spine.",
          ratio: 1.17
        },
        {
          heading: "design evolution",
          body: "From the first model to the final one. All 185 members that initially failed the modelled strength checks passed in the revised analysis.",
          image: "assets/images/work/project-05/panel-18.webp",
          alt: "Table and bar chart comparing three stages of the design: members failing 185, 1 and 0, and the highest utilisation falling from 18.66 to 0.62.",
          ratio: 1.953,
          colour: true
        },
        {
          heading: "footfall vibration",
          body: "Improved, but not yet enough for a public stair. Proposed dampers have not yet been verified.",
          image: "assets/images/work/project-05/panel-19.webp",
          alt: "Bar chart comparing the footfall response of eight design options against the limit for a public stair, with three short paragraphs below.",
          ratio: 1.953
        },
        {
          heading: "the revised stair",
          body: "The revised stair retains the original semicircular form. Under the modelled loads, it meets the strength checks and has limited deflection. Footfall vibration is still above the target for a busy public stair. Proposed dampers have not yet been verified, and the glass connections require further review. The work remains a preliminary structural study, not a certified design.",
          image: "assets/images/work/project-05/panel-20.webp",
          alt: "Render looking up at the revised stair from the floor of the room, with glass treads on rod frames along the curved steel spine and the glass balustrade above.",
          ratio: 1.419
        },
        {
          heading: "module from below",
          body: "Node block, rods and bearings. The revised scheme uses larger rods where needed, welded module connections and glass balustrades that contribute to stability.",
          image: "assets/images/work/project-05/panel-21.webp",
          alt: "Close view from below of the dark spine plate with its rod frames, bearing discs and glass treads.",
          ratio: 1.5
        },
        {
          heading: "joint details",
          body: "Bearings, nodes and glass fixings. The glass connections require further review.",
          image: "assets/images/work/project-05/panel-22.webp",
          alt: "Three joint drawings at larger scale: the tread bearing, the node block and the balustrade fixing.",
          ratio: 1.625
        },
        {
          heading: "under the flight",
          body: "One spine, twenty modules. The work remains a preliminary structural study, not a certified design.",
          image: "assets/images/work/project-05/panel-23.webp",
          alt: "Render of the whole stair from low on the underside: the dark curved spine below and the two glass balustrade ribbons above.",
          ratio: 1.263
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

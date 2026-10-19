(function () {
  /*
    Image structure for each finished project (AVIF with a WebP fallback; the viewer asks for the .avif sibling when the browser can decode it):
    assets/images/work/project-id/thumb-800.webp / thumb-1200.webp   overview tile (index.html, 7:5, srcset)
    assets/images/work/project-id/hero-1600.webp                      "image" below: viewer hero + first panel (7:5)
    assets/images/work/project-id/panel-2.webp ... panel-5.webp       one image per later panel (8:7, 1600 x 1400)

    Overview tiles load lazily; viewer images load only when a project is opened (the hero and panel 2 are
    warmed when a tile is hovered or touched, the remaining panels load in the background once it is open).
    "meta" is an optional one-line fact strip under the summary on the first panel.
  */
  window.HariniProjectData = [
    {
      id: "project-01",
      title: "pause",
      image: "assets/images/work/project-01/hero-1600.webp",
      alt: "Render of the Buckingham Canal edge: a stone arched bridge crosses still water beside a planted two-storey framework, with two people walking along the bank.",
      summary: "Can a station slow us down? An adaptive reuse proposal for the Thiruvanmiyur MRTS station and the Buckingham Canal edge, Chennai. Students, workers and travellers move between obligations, with little reason to notice the spaces they pass through. In the midst of chaos, can you be courageous enough to be calm?",
      meta: "adaptive reuse, public realm · 2025 · revit, d5 render, photoshop · academic project, in a pair",
      panels: [
        {
          heading: "pause",
          body: ""
        },
        {
          heading: "from stillness to site",
          body: "Stillness is a shift in attention, not an absence of movement: a view, shade, filtered light or a place to sit can interrupt the everyday rush without asking the city to stop. The station sits between the OMR IT corridor and canal-side neighbourhoods, yet its enclosed interior turns away from the water. A neglected interface, and an opportunity to reconnect transit and public life.",
          image: "assets/images/work/project-01/panel-2.webp",
          alt: "Plinth-level plan: the station's column grid, shops and restaurants beside the canal, with trees and canal-side housing blocks below."
        },
        {
          heading: "opening up the station",
          body: "Remove. Open. Plant. Connect. The design starts by subtracting: removing low floor plates, opening the canal-facing side and filtering western light through a jaali. Beneath the viaduct, a planted structural framework makes a shaded public route. Reuse before replacement: the existing concrete viaduct, an inserted structural framework and a planted public edge, in a repeatable module designed to extend along the viaduct.",
          image: "assets/images/work/project-01/panel-3.webp",
          alt: "Exploded isometric drawing of the station in layers, with an inserted framework in dark lines beside pale floor plans and a grey diagonal band."
        },
        {
          heading: "designing the pause",
          body: "Stillness is translated into four spatial cues rather than a single quiet room: framed views, filtered light, transparent edges and planting offer moments to notice, reorient and stay, while circulation continues around them. Inside, a public room: reclaimed volume, everyday activity and places to linger. Vegetation and porous screens are intended to temper dust, noise and heat while admitting daylight and air.",
          image: "assets/images/work/project-01/panel-4.webp",
          alt: "Render of the opened-up station interior: tall concrete columns, galleries with railings, a timber floor, planters with young trees and a person sitting on a bench."
        },
        {
          heading: "a different commute",
          body: "One journey, eight moments. A storyboard of a familiar commute tests how a station offering shade, views and places to sit could change the journey from a route to an experience. The proposal imagines a planted, shaded route beside the station, and public space beyond transit: a place to gather, rest and remain. In the midst of chaos, a place to pause.",
          image: "assets/images/work/project-01/panel-5.webp",
          alt: "Two frames from the storyboard: a commuter walking along a gallery beside the station stair, and a figure standing in a shaded walkway covered in creepers."
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
          image: "assets/images/work/project-02/panel-2.webp",
          alt: "Hand-drawn sheet of studies in a grid: a folder tree, a flat board and a three-dimensional workspace above studies in dots, frames and floors, with the workspace and study 7, a dotted field over a floor, outlined."
        },
        {
          heading: "placing, grouping, connecting",
          body: "In the first build the workspace had depth but behaved like a flat board. Items now sit on layers and can be pushed back or brought forward, and tilting the camera shows how they relate. Three actions organise the material: place an item, move related items together to form a group, and tie a thread to make a link explicit.",
          image: "assets/images/work/project-02/panel-3.webp",
          alt: "Two hand-drawn steps from the behaviour sketch: assets moved closer to form three groups, then connected with threads to form relationships."
        },
        {
          heading: "drawn first, then built",
          body: "Transitions were planned as storyboards before they were coded. An abrupt switch between screens would break the sense of moving through one space. When a project opens, the selected card breaks into particles, a floor forms and the material settles into place. Search follows the same logic: the camera travels to the result instead of jumping to it.",
          image: "assets/images/work/project-02/panel-4.webp",
          alt: "Hand-drawn storyboard of twelve frames showing a project card breaking into dots, a floor appearing and the material settling into the workspace."
        },
        {
          heading: "the archive in use",
          body: "Images, PDFs, notes, drawings and 3D models share one workspace. A drawing can sit above the model it belongs to, and items open in a focus view and keep their position between sessions. It has not yet been formally tested with other people. The next step is a short think-aloud study, to see whether arranging research spatially helps people find connections. Where something sits can say what it means.",
          image: "assets/images/work/project-02/panel-5.webp",
          alt: "A flat drawing of a building massing floating above the matching white 3D massing model in the dark workspace, with a thin thread running between them (sample material)."
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
          image: "assets/images/work/project-03/panel-2.webp",
          alt: "A rendered view along a lakeside road in evening light: railings and trees beside the lake on the left, an auto-rickshaw ahead, and a paved footpath with a drain grate on the right."
        },
        {
          heading: "building the world",
          body: "The street was blocked out in SketchUp from the plan and refined over thirteen passes with a fixed camera, so each change could be judged in the same view. In Unreal Engine the work moved to surfaces: worn plaster, wet floors, patched doors. Choices such as which paint had faded, or how high the water stains reach, were compared side by side.",
          image: "assets/images/work/project-03/panel-3.webp",
          alt: "Four views of the lane entry at different stages: a SketchUp blockout and the thirteenth SketchUp pass above, a grey Unreal clay render and the weathered Unreal render below."
        },
        {
          heading: "light tells the story",
          body: "An overcast morning made the lane flat; a low evening sun gave it structure. On the lakefront the sky is open and the light is even. In the lane the sky narrows to a strip, so light arrives in pools on the tea-stall step, the planks and a doorway. Every version was checked in grey values before colour. The light changes with the place, not the time.",
          image: "assets/images/work/project-03/panel-4.webp",
          alt: "The same view of the lane lit two ways: flat under an overcast morning sky above, and with low evening sun throwing long shadows across the walls and wet ground below."
        },
        {
          heading: "a lane that is lived in",
          body: "The lane is poorer than the lakefront but more alive, and the everyday work of coping says more than distress would: sweeping water back to the drain, wading with a bag held clear, lifting boxes to a high shelf.",
          image: "assets/images/work/project-03/panel-5.webp",
          alt: "A rendered view along a flooded lane: a yellow bicycle in the foreground, planks laid across the water as stepping stones, and washing hung across the far end."
        }
      ]
    },
    {
      id: "project-04",
      title: "shade",
      image: "assets/images/work/project-04/hero-1600.webp",
      alt: "Close view of a courtyard façade with rows of white vertical blades turned at an angle in front of dark glass, beside a pale vertical pier.",
      summary: "A façade study grown out of an IT office campus on Chennai's OMR, which I co-designed with a studio partner in the sixth semester, 2025. Its courtyard façades used vertical fins that responded to the changing floor heights. In 2026, I returned to the project independently to test whether those fins could perform better environmentally, without losing the logic of the original design. First, I needed to understand the rule that placed them there.",
      meta: "façade study, climate-responsive design · 2025 to 2026 · revit, rhino, grasshopper, radiance, blender · individual study of a co-designed studio building",
      panels: [
        {
          heading: "shade",
          body: ""
        },
        {
          heading: "the fins follow the floors",
          body: "The building steps between 3 m spaces for individual work, 6 m volumes for collaboration and 9 m shared spaces. The original fins follow the first storey of each volume, screening the occupied eye-level glazing while keeping the glass above clear for daylight. Traced against the model, the rule holds across approximately 99% of the courtyard glazing. Whether it also gave effective solar protection was still unknown.",
          image: "assets/images/work/project-04/panel-2.webp",
          alt: "View across the courtyard corner of the original building, with horizontal bands of vertical fins at different storeys and clear glass between and above them."
        },
        {
          heading: "reading chennai's sun",
          body: "The façade was tested against a year of Chennai's sun, with the building set to true north. The analysis drew attention to a problem the original pattern did not reveal: low-angle morning sunlight striking the east-facing courtyard glass. The identical fins performed unevenly across the two wings, blocking roughly two-thirds of direct sun on one façade but less than half on the other. One fin, two very different results.",
          image: "assets/images/work/project-04/panel-3.webp",
          alt: "Polar sun path diagram for Chennai, with a figure-of-eight loop for each daylight hour of the year and arcs for the solstices and equinox."
        },
        {
          heading: "from data to a moving fin",
          body: "Static variations in fin depth and spacing helped only modestly. Rather than replace the courtyard pattern, I retained the original fin bays and explored movement as the new variable. In Grasshopper, climate inputs, geometric limits and solar-response rules informed the blade configuration and hourly angles of independently controlled six-metre zones. The façade did not need a new visual language. It needed a new way to react to the sun.",
          image: "assets/images/work/project-04/panel-4.webp",
          alt: "Two views of the same band of kinetic blades on 21 April: at 07:00 the blades are seen edge-on to the glass, at 13:00 they are turned to show their faces."
        },
        {
          heading: "the fin, resolved and tested",
          body: "The original fin zones are preserved, each six-metre bay turning its blades together on one actuator, with a fail-safe open position. Simulated for occupied hours, direct-beam exposure behind the fins falls 24% on the SSW façade and 35% on the ESE façade against the original, with daylight maintained. A simulated design improvement, not a verified operational-energy saving. The fins still follow the floors; their angles now follow the sun.",
          image: "assets/images/work/project-04/panel-5.webp",
          alt: "Exploded view of one control zone: a slab edge and glass wall, bracket arms and a tie-bar, and a row of tall blades pulled out in front with their shadows on the ground."
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
          heading: "a repeated tread module",
          body: "The stair contains twenty repeated tread assemblies around a curved steel spine. Each assembly uses steel rods to support a glass tread at four points. The spine forms a half-circle and tapers along its length. The module layout was developed through physical and digital models.",
          image: "assets/images/work/project-05/panel-2.webp",
          alt: "Top view of the hand-built model: black rods fanning around a half circle on a white card base, one rod frame for each tread."
        },
        {
          heading: "tracing the load path",
          body: "The Revit geometry was transferred into Robot Structural Analysis, allowing the same model to be checked without rebuilding it. Load-path studies followed forces from the tread through the rods and spine. Initial checks showed overstressed members, particularly in the slender rods supporting the glass corners.",
          image: "assets/images/work/project-05/panel-3.webp",
          alt: "Diagram of one tread module under a 4.5 kN load, with the tension and compression forces labelled on each rod and the spine plate running beneath."
        },
        {
          heading: "revising the structure",
          body: "Several structural options were compared while retaining the semicircular form. Thickening the spine and adding supports beneath the stair were not taken forward. The revised scheme uses larger rods where needed, welded module connections and glass balustrades that contribute to stability. All 185 members that initially failed the modelled strength checks passed in the revised analysis.",
          image: "assets/images/work/project-05/panel-4.webp",
          alt: "Revit view of the stair with rod tripods propping the spine from below, one of the options that was not taken forward."
        },
        {
          heading: "the revised stair",
          body: "The revised stair retains the original semicircular form. Under the modelled loads, it meets the strength checks and has limited deflection. Footfall vibration is still above the target for a busy public stair. Proposed dampers have not yet been verified, and the glass connections require further review. The work remains a preliminary structural study, not a certified design.",
          image: "assets/images/work/project-05/panel-5.webp",
          alt: "Render looking up at the revised stair from the floor of the room, with glass treads on rod frames along the curved steel spine and the glass balustrade above."
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

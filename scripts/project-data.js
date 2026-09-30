(function () {
  /*
    Recommended image structure for each finished project:
    assets/images/work/project-id/thumb-1200.webp
    assets/images/work/project-id/thumb-1600.webp
    assets/images/work/project-id/hero-2200.webp
    assets/images/work/project-id/process-01.webp

    Keep overview thumbnails lightweight. Load hero/process images only when
    project focus mode opens.
  */
  window.HariniProjectData = [
    {
      id: "project-01",
      title: "project title placeholder",
      image: "assets/images/work/project-01.svg",
      alt: "black and white architectural placeholder image for project 01",
      summary: "brief project information placeholder for a spatial, visual, or interaction-led work.",
      panels: [
        {
          heading: "title / introduction",
          body: "A short opening note will introduce the project, its role, and the design question."
        },
        {
          heading: "context",
          body: "Placeholder context for site, audience, constraints, collaborators, and timeline."
        },
        {
          heading: "concept / process",
          body: "A concise process story can describe sketches, systems, iterations, and decisions."
        },
        {
          heading: "drawings / diagrams",
          body: "This panel can hold drawings, diagrams, or structured visual thinking."
        },
        {
          heading: "renders / outcome",
          body: "Final output, learnings, and selected documentation can sit here."
        }
      ]
    },
    {
      id: "project-02",
      title: "project title placeholder",
      image: "assets/images/work/project-02.svg",
      alt: "black and white architectural placeholder image for project 02",
      summary: "brief project information placeholder for a built, animated, or researched outcome.",
      panels: [
        {
          heading: "title / introduction",
          body: "A project-specific introduction will replace this placeholder."
        },
        {
          heading: "context",
          body: "Use this space for the brief, site, problem, and operating conditions."
        },
        {
          heading: "concept / process",
          body: "Document the thinking with careful edits rather than a dense process dump."
        },
        {
          heading: "drawings / diagrams",
          body: "Insert diagrams, frames, notes, or plan-based material in a later pass."
        },
        {
          heading: "renders / outcome",
          body: "Outcome imagery and a compact reflection can close the story."
        }
      ]
    },
    {
      id: "project-03",
      title: "project title placeholder",
      image: "assets/images/work/project-03.svg",
      alt: "black and white architectural placeholder image for project 03",
      summary: "brief project information placeholder for a precise design study.",
      panels: [
        {
          heading: "title / introduction",
          body: "The introduction panel is intentionally short and image-adjacent."
        },
        {
          heading: "context",
          body: "Add the challenge, scope, and relevant background here."
        },
        {
          heading: "concept / process",
          body: "Show the movement from observation to system to form."
        },
        {
          heading: "drawings / diagrams",
          body: "Use this as a frame for drawings, mappings, or motion tests."
        },
        {
          heading: "renders / outcome",
          body: "Place the resolved work and a restrained note on the result here."
        }
      ]
    },
    {
      id: "project-04",
      title: "project title placeholder",
      image: "assets/images/work/project-04.svg",
      alt: "black and white architectural placeholder image for project 04",
      summary: "brief project information placeholder for an experimental project.",
      panels: [
        {
          heading: "title / introduction",
          body: "This panel can identify the work without adding titles to the overview."
        },
        {
          heading: "context",
          body: "A few lines can explain the origin and conditions of the project."
        },
        {
          heading: "concept / process",
          body: "Use this panel for the strongest process movement, not every artifact."
        },
        {
          heading: "drawings / diagrams",
          body: "Drawings, diagrams, and image sequences can be added later."
        },
        {
          heading: "renders / outcome",
          body: "Final documentation can occupy this closing panel."
        }
      ]
    },
    {
      id: "project-05",
      title: "project title placeholder",
      image: "assets/images/work/project-05.svg",
      alt: "black and white architectural placeholder image for project 05",
      summary: "brief project information placeholder for a final selected work.",
      panels: [
        {
          heading: "title / introduction",
          body: "The project begins with a clean title and compact description."
        },
        {
          heading: "context",
          body: "Describe the setting, research, or assignment with restraint."
        },
        {
          heading: "concept / process",
          body: "A single strong process thread can carry the reader forward."
        },
        {
          heading: "drawings / diagrams",
          body: "This panel is prepared for visual development material."
        },
        {
          heading: "renders / outcome",
          body: "Use final images and a concise outcome statement here."
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

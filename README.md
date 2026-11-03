# STEP Research Laboratory

Repository for the STEP Laboratory at the Department of Chemical Engineering and Bioprocesses, Pontificia Universidad Católica de Chile. Led by Dr. Roberto I. Canales and Dr. Nicolás F. Gajardo-Parra.

Two things live here:

| | What it is | Where it runs |
|---|---|---|
| **Public website** | Jekyll site — people, research, publications, positions | [step-group.github.io/step-webpage](https://step-group.github.io/step-webpage/), built by GitHub Pages |
| **Lab platform** | Internal app for inventory, experiments, datasets and publications | `app/` on Netlify, `api/` on Render |

The platform has its own documentation: **[`app/README.md`](app/README.md)** (React frontend) and **[`api/README.md`](api/README.md)** (Express + PostgreSQL backend). The rest of this file is about the website.

## Repository layout

```
_data/          content as YAML — publications, people, news, themes
_pages/         one file per page; permalink is set in the front matter
_layouts/       page skeletons (homelay, gridlay, textlay, publications, research)
_includes/      header, footer, carousel, news sidebar
_sass/, css/    Bootstrap 3 styles
images/         teampic/, carouselpic/, researchpic/, logopic/, grouppic/
app/, api/      the lab platform — see their own READMEs
```

## Contributing

Group members with write access work on a branch in this repository and open a pull request. Do not commit to `main` directly.

```bash
git clone https://github.com/step-group/step-webpage.git
cd step-webpage
git checkout -b short-descriptive-name
# make your changes
git add .
git commit -m "Describe what changed"
git push -u origin short-descriptive-name
```

Then open a pull request on GitHub for review. Once it is merged, GitHub Pages rebuilds and the change is live in about a minute.

If you do not have write access, fork the repository and open the pull request from your fork instead.

## Editing website content

Almost everything is a YAML file in `_data/`. You rarely need to touch HTML.

### Adding yourself to the People page

1. Add a square photo to `images/teampic/` named `Lastname_Firstname.jpg` (or `.png`).
2. Open the `_data/` file matching your position — `postdocs.yml`, `grad_students.yml`, or `masters.yml`.
3. Add an entry:

```yaml
- name: Your Full Name
  photo: Lastname_Firstname.jpg
  info: Ph.D. Student in Chemical Engineering
  email: you@uc.cl
  description: One or two sentences about your background and what you work on.
  linkedin: https://www.linkedin.com/in/your-profile/   # optional
  website: https://your-site.com                        # optional
  twitter: https://x.com/your-handle                    # optional
```

People who leave the group move to `_data/alumni.yml`, which takes `name`, `previous`, and optionally `current` and `link`.

### Adding a publication

Entries go at the **top** of `_data/publications.yml`, newest first, and `number` counts down to 1 at the bottom. Increment the top number when you add one.

```yaml
- number: 73
  title: "Full title of the paper"
  authors: Surname, A.B.; <b>Gajardo-Parra, N.F.</b>; <b>Canales, R.I.</b>; Other, C.D.
  journal: Journal of Chemical & Engineering Data
  volume: 71
  issue: 6
  pages: 2512-2522
  year: 2026
  url: 'https://doi.org/10.1021/acs.jced.6c00016'
  doi: 'https://doi.org/10.1021/acs.jced.6c00016'
  themes:
    - Deep Eutectic Solvents
    - Thermophysical Properties
```

Conventions that matter:

- **PI names are bolded** with `<b>...</b>`, always as `Gajardo-Parra, N.F.` and `Canales, R.I.`
- **The title links to the DOI** — put `https://doi.org/...` in `url`
- **Every paper carries at least two themes.** Quote any `pages` value that starts with a zero (`pages: '05025007'`), otherwise YAML reads it as an octal number and the article number renders wrong.
- Preprints use `preprint` and `preprint_url` instead of `doi`; a Preprint button appears automatically.

Update the "Last updated" line at the top of `_pages/publications.md` when you do a batch update.

### Research themes

The tags below each citation double as filter buttons. They are defined in `_data/research_themes.yml`, and a theme name that does not appear there renders no badge at all — silently. The current set:

| Theme | Covers |
|---|---|
| Thermodynamic Modeling | PC-SAFT, ePC-SAFT, COSMO-RS, NRTL, DGT, equations of state, phase-equilibrium modeling |
| Thermophysical Properties | measured density, viscosity, surface and interfacial tension, excess properties, solubility and VLE/LLE data |
| Molecular Simulation | molecular dynamics, Monte Carlo, DFT, docking, force-field work |
| Deep Eutectic Solvents | DES and NADES as the solvent under study |
| Ionic Liquids | ionic liquids and poly(ionic liquid)s |
| Bioseparations | extraction, purification, in-situ product removal, adsorption and supercritical separations |
| Biocatalysis | enzymes, proteins, fermentation, enzyme kinetics and stability |
| Process Simulation | Aspen Plus, process design, techno-economics, reactor engineering |
| Catalysis | heterogeneous and electrochemical catalysts, hydrogenation, hydrodeoxygenation |

To add a theme, append a `name`, `color` and `darker_color` (the shade shown when the filter is active) to `_data/research_themes.yml`.

### News

`_data/news.yml`, newest first. Markdown links work inside `headline`.

```yaml
- date: September 2026
  headline: Congrats to X for their Ph.D. defense!
```

The home page shows the most recent items; `/news` shows all of them.

### Research page and carousel

`_pages/research.md` is written directly in Markdown and HTML — project descriptions, grant numbers, funding periods and the finished-projects list. Figures live in `images/researchpic/`.

The home page carousel is declared by hand in `_includes/carousel.html`, with images in `images/carouselpic/`. Each slide is an image, a caption and a link to the paper. If you add or remove a slide, update the `<ol class="carousel-indicators">` list at the top of that file to match the number of slides.

## Previewing locally

Needed for anything beyond a content edit — layout, CSS, or navigation changes.

Install Ruby and Jekyll following the [official guide](https://jekyllrb.com/docs/installation/), then:

```bash
gem install bundler jekyll
jekyll serve
```

The site config points `url` and `baseurl` at the production address, so links break in a local preview. Create a `_config.dev.yml` (already git-ignored) with:

```yaml
url: ""
baseurl: ""
```

and serve with both configs:

```bash
jekyll serve --config _config.yml,_config.dev.yml
```

The site is then at `http://localhost:4000`.

## Deployment

| Part | Trigger | Config |
|---|---|---|
| Website | push to `main` | GitHub Pages, ~1 minute |
| `app/` | push to `main` | `netlify.toml` |
| `api/` | push to `main` | `render.yaml` (runs migrations and seeds, then starts) |

## Credits

The site was built with [Jekyll](https://jekyllrb.com). The template comes from the [Coley Research Group](https://coley.mit.edu) at MIT, which in turn adapted it from the [Allan Lab](https://www.allanlab.org/aboutwebsite.html) at Leiden University.

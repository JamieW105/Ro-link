(() => {
  const menuButton = document.querySelector(".menu-toggle");
  const menu = document.querySelector("#primary-links");
  const helpMenus = document.querySelectorAll(".help-menu");
  const year = document.querySelector("#year");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const closeHelpMenus = (except) => {
    helpMenus.forEach((details) => {
      if (details !== except) details.removeAttribute("open");
    });
  };

  const closeMobileMenu = () => {
    if (!menuButton || !menu) return;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation menu");
    menu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    closeHelpMenus();
  };

  if (menuButton && menu) {
    menuButton.addEventListener("click", () => {
      const willOpen = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(willOpen));
      menuButton.setAttribute("aria-label", willOpen ? "Close navigation menu" : "Open navigation menu");
      menu.classList.toggle("is-open", willOpen);
      document.body.classList.toggle("menu-open", willOpen);
    });

    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMobileMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeMobileMenu();
    });
  }

  helpMenus.forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open) closeHelpMenus(details);
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".help-menu")) closeHelpMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeHelpMenus();
      closeMobileMenu();
    }
  });

  const reportForm = document.querySelector("#report-form");
  if (reportForm) {
    const targetButtons = reportForm.querySelectorAll("[data-report-target]");
    const platformField = reportForm.querySelector("#report-platform");
    const targetLabel = reportForm.querySelector("#target-id-label");
    const targetInput = reportForm.querySelector("#report-target-id");
    const feedback = reportForm.querySelector("#report-feedback");
    let targetKind = "user";

    const targetConfig = {
      user: { label: "Roblox user ID", placeholder: "123456789" },
      server: { label: "Discord server ID", placeholder: "123456789012345678" },
      game: { label: "Roblox game ID", placeholder: "1234567890" },
    };

    const updateTarget = (nextTarget) => {
      targetKind = nextTarget;
      targetButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.reportTarget === nextTarget));
      });

      const config = targetConfig[nextTarget];
      if (targetLabel) targetLabel.textContent = config.label;
      if (targetInput) targetInput.placeholder = config.placeholder;
      if (platformField) platformField.disabled = nextTarget !== "user";
    };

    targetButtons.forEach((button) => {
      button.addEventListener("click", () => updateTarget(button.dataset.reportTarget));
    });

    platformField?.addEventListener("change", () => {
      if (targetKind !== "user" || !targetLabel || !targetInput) return;
      const isRoblox = platformField.value === "roblox";
      targetLabel.textContent = isRoblox ? "Roblox user ID" : "Discord user ID";
      targetInput.placeholder = isRoblox ? "123456789" : "123456789012345678";
    });

    reportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = reportForm.querySelector('button[type="submit"]');
      const formData = new FormData(reportForm);

      if (feedback) {
        feedback.className = "feedback is-visible";
        feedback.textContent = "Submitting report...";
      }
      if (submitButton) submitButton.disabled = true;

      try {
        const response = await fetch("/api/public-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetKind,
            userPlatform: targetKind === "user" ? formData.get("userPlatform") : undefined,
            targetId: String(formData.get("targetId") || "").trim(),
            reason: String(formData.get("reason") || "").trim(),
            evidenceLinks: String(formData.get("evidenceLinks") || "").trim(),
          }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error || "The report could not be submitted.");
        }

        if (feedback) {
          feedback.className = "feedback is-visible is-success";
          feedback.textContent = result.reportId
            ? `Report submitted. Reference: ${result.reportId}`
            : "Report submitted successfully.";
        }
        reportForm.reset();
        updateTarget("user");
      } catch (error) {
        if (feedback) {
          feedback.className = "feedback is-visible is-error";
          feedback.textContent = error instanceof Error
            ? error.message
            : "The report could not be submitted.";
        }
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  const careersList = document.querySelector("#careers-list");
  if (careersList) {
    const loading = document.querySelector("#careers-loading");
    const empty = document.querySelector("#careers-empty");
    const search = document.querySelector("#career-search");
    const filterButtons = document.querySelectorAll("[data-career-filter]");
    let jobs = [];
    let activeFilter = "";

    const renderJobs = () => {
      const query = String(search?.value || "").trim().toLowerCase();
      const filtered = jobs.filter((job) => {
        const title = String(job.title || "");
        const description = String(job.description || "");
        const tags = Array.isArray(job.tags) ? job.tags.map(String) : [];
        const matchesQuery = !query || `${title} ${description}`.toLowerCase().includes(query);
        const matchesFilter = !activeFilter || tags.includes(activeFilter);
        return job.status !== "CLOSED" && matchesQuery && matchesFilter;
      });

      careersList.replaceChildren();
      filtered.forEach((job) => {
        const row = document.createElement("article");
        row.className = "data-row";

        const main = document.createElement("div");
        main.className = "data-row-main";

        const meta = document.createElement("div");
        meta.className = "data-row-meta";
        const tags = Array.isArray(job.tags) ? job.tags.slice(0, 4) : [];
        tags.forEach((tag) => {
          const item = document.createElement("span");
          item.textContent = String(tag);
          meta.append(item);
        });

        const title = document.createElement("h2");
        title.textContent = String(job.title || "Untitled position");
        const description = document.createElement("p");
        description.textContent = String(job.description || "");
        main.append(meta, title, description);

        const action = document.createElement("a");
        action.className = "data-row-action";
        action.href = `/careers/${encodeURIComponent(String(job.id || ""))}`;
        action.setAttribute("aria-label", `View ${title.textContent}`);
        const arrow = document.createElement("iconify-icon");
        arrow.setAttribute("icon", "lucide:arrow-right");
        arrow.setAttribute("aria-hidden", "true");
        action.append(arrow);

        row.append(main, action);
        careersList.append(row);
      });

      if (empty) empty.hidden = filtered.length !== 0;
    };

    search?.addEventListener("input", renderJobs);
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.careerFilter || "";
        filterButtons.forEach((candidate) => {
          candidate.setAttribute("aria-pressed", String(candidate === button));
        });
        renderJobs();
      });
    });

    fetch("/api/careers")
      .then((response) => {
        if (!response.ok) throw new Error("Current positions could not be loaded.");
        return response.json();
      })
      .then((data) => {
        jobs = Array.isArray(data) ? data : [];
        renderJobs();
      })
      .catch(() => {
        careersList.replaceChildren();
        if (empty) {
          empty.hidden = false;
          empty.querySelector("strong").textContent = "Current positions are unavailable in this preview";
          empty.querySelector("span").textContent = "Open the live Careers page to load current opportunities.";
        }
      })
      .finally(() => {
        if (loading) loading.hidden = true;
      });
  }

  const postsList = document.querySelector("#posts-list");
  if (postsList) {
    const loading = document.querySelector("#posts-loading");
    const empty = document.querySelector("#posts-empty");
    const search = document.querySelector("#post-search");
    let posts = [];

    const formatDate = (value) => {
      if (!value) return "Unpublished";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Unpublished";
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    };

    const renderPosts = () => {
      const query = String(search?.value || "").trim().toLowerCase();
      const filtered = posts.filter((post) => {
        const title = String(post.title || "");
        const description = String(post.description || "");
        return !query || `${title} ${description}`.toLowerCase().includes(query);
      });

      postsList.replaceChildren();
      filtered.forEach((post) => {
        const row = document.createElement("article");
        row.className = "data-row";

        const main = document.createElement("div");
        main.className = "data-row-main";

        const meta = document.createElement("div");
        meta.className = "data-row-meta";

        const version = document.createElement("span");
        const versionIcon = document.createElement("iconify-icon");
        versionIcon.setAttribute("icon", "lucide:package");
        versionIcon.setAttribute("aria-hidden", "true");
        version.append(versionIcon, document.createTextNode(
          post.rolink_version ? `Ro-Link ${post.rolink_version}` : "Ro-Link update",
        ));

        const date = document.createElement("span");
        const dateIcon = document.createElement("iconify-icon");
        dateIcon.setAttribute("icon", "lucide:calendar-days");
        dateIcon.setAttribute("aria-hidden", "true");
        date.append(dateIcon, document.createTextNode(formatDate(post.published_at)));
        meta.append(version, date);

        const title = document.createElement("h2");
        title.textContent = String(post.title || "Untitled update");
        const description = document.createElement("p");
        description.textContent = String(post.description || "");
        main.append(meta, title, description);

        const action = document.createElement("a");
        action.className = "data-row-action";
        action.href = `/posts/${encodeURIComponent(String(post.slug || ""))}`;
        action.setAttribute("aria-label", `Read ${title.textContent}`);
        const arrow = document.createElement("iconify-icon");
        arrow.setAttribute("icon", "lucide:arrow-right");
        arrow.setAttribute("aria-hidden", "true");
        action.append(arrow);

        row.append(main, action);
        postsList.append(row);
      });

      if (empty) empty.hidden = filtered.length !== 0;
    };

    search?.addEventListener("input", renderPosts);

    fetch("/api/posts")
      .then((response) => {
        if (!response.ok) throw new Error("Current posts could not be loaded.");
        return response.json();
      })
      .then((data) => {
        posts = Array.isArray(data) ? data : [];
        renderPosts();
      })
      .catch(() => {
        postsList.replaceChildren();
        if (empty) {
          empty.hidden = false;
          empty.querySelector("strong").textContent = "Current posts are unavailable in this preview";
          empty.querySelector("span").textContent = "Open the live Posts page to load published updates.";
        }
      })
      .finally(() => {
        if (loading) loading.hidden = true;
      });
  }
})();

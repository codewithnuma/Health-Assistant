import React, {
  useState,
  useEffect,
} from "react";

import axiosInstance from "../../axiosInstance";
import Header from "../Header/Header";
import Footer from "../Footer/Footer";

import "./Reports.css";


const Reports = () => {

  // =====================================================
  // STATE
  // =====================================================

  const [pendingReports, setPendingReports] =
    useState([]);

  const [acceptedReports, setAcceptedReports] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [selectedCategory, setSelectedCategory] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [actionLoading, setActionLoading] =
    useState(null);

  const [successMessage, setSuccessMessage] =
    useState(null);

  const [organizerId, setOrganizerId] =
    useState(null);


  // =====================================================
  // BACKEND URL
  // =====================================================

  const BACKEND_URL =
    "http://127.0.0.1:8000/";


  // =====================================================
  // IMAGE URLS
  // =====================================================

  const [imageUrls, setImageUrls] =
    useState({});


  // =====================================================
  // GET FULL IMAGE URL
  // =====================================================

  const getFullImageUrl = (
    imagePath
  ) => {

    if (!imagePath) {
      return null;
    }

    // Already full URL

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://")
    ) {
      return imagePath;
    }

    // Relative image path

    return `${BACKEND_URL.replace(
      /\/$/,
      ""
    )}/${imagePath.replace(
      /^\/+/,
      ""
    )}`;
  };


  // =====================================================
  // LOAD IMAGE USING AXIOS
  // =====================================================

  const loadImage = async (
    imagePath,
    key
  ) => {

    if (!imagePath) {
      return;
    }

    try {

      const imageUrl =
        getFullImageUrl(imagePath);

      const response =
        await axiosInstance.get(
          imageUrl,
          {
            responseType: "blob",
          }
        );

      if (!response.data) {
        throw new Error(
          "Empty image response"
        );
      }

      const blobUrl =
        URL.createObjectURL(
          response.data
        );

      setImageUrls((previous) => ({
        ...previous,
        [key]: blobUrl,
      }));

    } catch (err) {

      console.error(
        "Failed to load image:",
        imagePath,
        err
      );

      // Fallback to direct image URL

      const directUrl =
        getFullImageUrl(imagePath);

      setImageUrls((previous) => ({
        ...previous,
        [key]: directUrl,
      }));
    }
  };


  // =====================================================
  // LOAD REPORT IMAGES
  // =====================================================

  const loadReportImages = (
    reports,
    accepted
  ) => {

    const requests = [];


    // Pending report images

    reports.forEach((report) => {

      if (report.image) {

        requests.push(
          loadImage(
            report.image,
            `pending-${report.id}`
          )
        );
      }

    });


    // Accepted report images

    accepted.forEach((item) => {

      const problem =
        item.problem &&
          typeof item.problem === "object"
          ? item.problem
          : item;

      const image =
        problem?.image ||
        item.image ||
        null;

      if (image) {

        requests.push(
          loadImage(
            image,
            `accepted-${item.id}`
          )
        );
      }

    });


    return Promise.allSettled(
      requests
    );
  };


  // =====================================================
  // FETCH DATA
  // =====================================================

  const fetchDashboardData =
    async () => {

      setLoading(true);

      setError(null);

      try {

        // ===============================================
        // GET CURRENT USER
        // ===============================================

        let currentUserId =
          null;

        try {

          const userRes =
            await axiosInstance.get(
              "/accounts/me/"
            );

          currentUserId =
            userRes.data?.id ||
            userRes.data?.pk ||
            null;

        } catch (err) {

          try {

            const userResAlt =
              await axiosInstance.get(
                "/auth/users/me/"
              );

            currentUserId =
              userResAlt.data?.id ||
              userResAlt.data?.pk ||
              null;

          } catch (secondError) {

            console.error(
              "Could not fetch current user:",
              secondError
            );
          }
        }


        if (currentUserId) {

          setOrganizerId(
            currentUserId
          );
        }


        // ===============================================
        // FETCH CATEGORIES + REPORTS
        // ===============================================

        const [

          categoriesRes,

          allReportsRes,

          acceptedRes,

        ] = await Promise.all([

          axiosInstance.get(
            "/problem/categories/"
          ),

          axiosInstance.get(
            "/problem/reports/"
          ),

          axiosInstance.get(
            "/organization/problem-reports/"
          ),

        ]);


        // ===============================================
        // NORMALIZE CATEGORY DATA
        // ===============================================

        const categoryList =
          Array.isArray(
            categoriesRes.data
          )
            ? categoriesRes.data
            : categoriesRes.data?.results ||
            [];


        // ===============================================
        // NORMALIZE ALL REPORT DATA
        // ===============================================

        const allReports =
          Array.isArray(
            allReportsRes.data
          )
            ? allReportsRes.data
            : allReportsRes.data?.results ||
            [];


        // ===============================================
        // NORMALIZE ACCEPTED DATA
        // ===============================================

        const accepted =
          Array.isArray(
            acceptedRes.data
          )
            ? acceptedRes.data
            : acceptedRes.data?.results ||
            [];


        // ===============================================
        // FIND ALREADY ACCEPTED REPORTS
        // ===============================================

        const acceptedProblemIds =
          new Set(

            accepted
              .map((item) => {

                if (
                  item.problem &&
                  typeof item.problem ===
                  "object"
                ) {

                  return (
                    item.problem?.id
                  );
                }

                return item.problem;

              })

              .filter(Boolean)

          );


        // ===============================================
        // ONLY PENDING + NOT ALREADY ACCEPTED
        // ===============================================

        const pending =
          allReports.filter(
            (report) =>
              String(
                report.status || ""
              )
                .toLowerCase()
                .trim() ===
              "pending" &&

              !acceptedProblemIds.has(
                report.id
              )
          );


        // ===============================================
        // SAVE DATA
        // ===============================================

        setCategories(
          categoryList
        );

        setPendingReports(
          pending
        );

        setAcceptedReports(
          accepted
        );


        // ===============================================
        // LOAD IMAGES
        // ===============================================

        await loadReportImages(
          pending,
          accepted
        );


      } catch (err) {

        console.error(
          "Failed to load dashboard:",
          err.response?.data || err
        );

        setError(
          "Failed to fetch reports from the server. Please check your connection."
        );

      } finally {

        setLoading(false);
      }
    };


  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {

    fetchDashboardData();

  }, []);


  // =====================================================
  // GET REPORT CATEGORY ID
  // =====================================================

  const getReportCategoryId =
    (report) => {

      if (!report) {
        return null;
      }


      // category is directly an ID

      if (
        report.category !== null &&
        report.category !== undefined &&
        typeof report.category !== "object"
      ) {

        return report.category;
      }


      // category is an object

      if (
        report.category &&
        typeof report.category === "object"
      ) {

        return (
          report.category.id ??
          null
        );
      }


      // category_detail object

      if (
        report.category_detail &&
        typeof report.category_detail ===
        "object"
      ) {

        return (
          report.category_detail.id ??
          null
        );
      }


      return null;
    };


  // =====================================================
  // FILTER REPORTS BY CATEGORY
  // =====================================================

  const filteredPendingReports =
    selectedCategory === "all"

      ? pendingReports

      : pendingReports.filter(
        (report) => {

          const reportCategoryId =
            getReportCategoryId(
              report
            );

          return (
            String(
              reportCategoryId
            ) ===
            String(
              selectedCategory
            )
          );
        }
      );


  // =====================================================
  // CATEGORY COUNT
  // =====================================================

  const getCategoryReportCount =
    (categoryId) => {

      return pendingReports.filter(
        (report) => {

          const reportCategoryId =
            getReportCategoryId(
              report
            );

          return (
            String(
              reportCategoryId
            ) ===
            String(
              categoryId
            )
          );
        }
      ).length;
    };


  // =====================================================
  // GET CATEGORY NAME
  // =====================================================

  const getCategoryName =
    (report) => {

      if (
        report.category_detail?.name
      ) {

        return (
          report.category_detail.name
        );
      }


      if (
        report.category &&
        typeof report.category ===
        "object"
      ) {

        return (
          report.category.name ||
          "General"
        );
      }


      if (
        report.category_name
      ) {

        return (
          report.category_name
        );
      }


      const categoryId =
        getReportCategoryId(
          report
        );

      const foundCategory =
        categories.find(
          (category) =>
            String(category.id) ===
            String(categoryId)
        );

      return (
        foundCategory?.name ||
        "General"
      );
    };


  // =====================================================
  // ACCEPT REPORT
  // =====================================================

  const handleAcceptReport =
    async (problemId) => {

      setActionLoading(
        problemId
      );

      setError(null);

      setSuccessMessage(null);

      try {

        let activeOrgId =
          organizerId;


        // -----------------------------------------------
        // FALLBACK USER ID
        // -----------------------------------------------

        if (!activeOrgId) {

          for (
            let i = 0;
            i < localStorage.length;
            i++
          ) {

            const key =
              localStorage.key(i);

            const value =
              localStorage.getItem(
                key
              );

            if (!value) {
              continue;
            }

            try {

              const parsed =
                JSON.parse(value);

              if (
                parsed &&
                typeof parsed ===
                "object"
              ) {

                activeOrgId =
                  parsed.id ||
                  parsed.user_id ||
                  parsed.pk ||
                  null;

                if (
                  activeOrgId
                ) {
                  break;
                }
              }

            } catch (parseError) {

              // Ignore non-JSON localStorage

            }
          }
        }


        // -----------------------------------------------
        // USER NOT FOUND
        // -----------------------------------------------

        if (!activeOrgId) {

          setError(
            "Organizer user ID could not be retrieved. Please refresh the page and try again."
          );

          return;
        }


        // -----------------------------------------------
        // CREATE ASSIGNMENT
        // -----------------------------------------------

        await axiosInstance.post(
          "/organization/problem-reports/",
          {

            organization:
              activeOrgId,

            problem:
              problemId,

          }
        );


        // -----------------------------------------------
        // SUCCESS
        // -----------------------------------------------

        setSuccessMessage(
          "Problem report successfully accepted and moved to your assignments."
        );


        // Remove immediately from pending list

        setPendingReports(
          (previous) =>
            previous.filter(
              (report) =>
                String(
                  report.id
                ) !==
                String(
                  problemId
                )
            )
        );


        // Reload all data

        await fetchDashboardData();


        setTimeout(() => {

          setSuccessMessage(
            null
          );

        }, 4000);


      } catch (err) {

        console.error(
          "Failed to accept report:",
          err.response?.data || err
        );


        const responseData =
          err.response?.data;


        if (
          responseData &&
          typeof responseData ===
          "object"
        ) {

          const messages = [];


          Object.entries(
            responseData
          ).forEach(
            ([
              field,
              value,
            ]) => {

              if (
                Array.isArray(value)
              ) {

                messages.push(
                  `${field}: ${value.join(", ")}`
                );

              } else {

                messages.push(
                  `${field}: ${String(value)}`
                );
              }
            }
          );


          setError(
            messages.length > 0
              ? messages.join(" | ")
              : "Failed to accept the report."
          );

        } else {

          setError(
            "Failed to accept the report."
          );
        }

      } finally {

        setActionLoading(
          null
        );
      }
    };


  // =====================================================
  // CLEAN UP BLOB URLS
  // =====================================================

  useEffect(() => {

    return () => {

      Object.values(
        imageUrls
      ).forEach(
        (url) => {

          if (
            url &&
            url.startsWith("blob:")
          ) {

            URL.revokeObjectURL(
              url
            );
          }
        }
      );
    };

  }, [imageUrls]);


  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (

      <div className="gov-dashboard-wrapper">

        <Header />

        <main className="reports-loading-area">

          <div className="gov-loader">
            Loading Incident Reports...
          </div>

        </main>

        <Footer />

      </div>
    );
  }


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="gov-dashboard-wrapper">

      <Header />


      {/* =================================================
          HERO
      ================================================= */}

      <section className="reports-hero-section">

        <div className="reports-hero-content">

          <h1>
            Organization Incident Management
          </h1>

          <p>
            Review community-submitted problem reports
            across the municipality. Select a category,
            review pending issues, and accept reports for
            your organization's action timeline.
          </p>

        </div>

      </section>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="reports-main-container">


        {/* ERROR */}

        {error && (

          <div className="gov-alert error">
            {error}
          </div>

        )}


        {/* SUCCESS */}

        {successMessage && (

          <div className="gov-alert success">
            ✓ {successMessage}
          </div>

        )}


        {/* ===============================================
            CATEGORY NAVIGATION

            THIS IS DIRECTLY BEFORE:
            All Pending Civic Reports
        =============================================== */}

        <section className="reports-category-section">

          <div className="reports-category-nav-header">

            <div>

              <h2>
                Browse by Category
              </h2>

              <p>
                Select a category to view matching
                pending civic reports.
              </p>

            </div>

          </div>


          <div className="reports-category-nav">


            {/* ALL REPORTS */}

            <button
              type="button"

              className={
                selectedCategory === "all"
                  ? "category-nav-btn active"
                  : "category-nav-btn"
              }

              onClick={() =>
                setSelectedCategory("all")
              }
            >

              <span className="category-icon">
                📋
              </span>

              <span className="category-name">
                All Reports
              </span>

              <span className="category-count">
                {pendingReports.length}
              </span>

            </button>


            {/* DJANGO CATEGORIES */}

            {categories.map(
              (category) => (

                <button
                  key={category.id}

                  type="button"

                  className={
                    String(
                      selectedCategory
                    ) ===
                      String(
                        category.id
                      )
                      ? "category-nav-btn active"
                      : "category-nav-btn"
                  }

                  onClick={() =>
                    setSelectedCategory(
                      category.id
                    )
                  }
                >

                  <span className="category-icon">
                    📌
                  </span>

                  <span className="category-name">
                    {category.name}
                  </span>

                  <span className="category-count">
                    {
                      getCategoryReportCount(
                        category.id
                      )
                    }
                  </span>

                </button>

              )
            )}

          </div>

        </section>


        {/* ===============================================
            ALL PENDING REPORTS HEADER

            CATEGORY NAVIGATION IS ABOVE THIS
        =============================================== */}

        <div className="reports-section-header">

          <div>

            <h2>

              {selectedCategory === "all"
                ? `All Pending Civic Reports (${filteredPendingReports.length})`
                : `${categories.find(
                  (category) =>
                    String(
                      category.id
                    ) ===
                    String(
                      selectedCategory
                    )
                )?.name || "Category"
                } Reports (${filteredPendingReports.length})`
              }

            </h2>

            <p>

              {selectedCategory === "all"
                ? "Select pending reports below to claim ownership and begin resolution."
                : "Showing pending reports from the selected category."
              }

            </p>

          </div>

        </div>


        {/* ===============================================
            EMPTY
        =============================================== */}

        {filteredPendingReports.length === 0 ? (

          <div className="reports-empty-card">

            <h3>
              No Pending Reports Available
            </h3>

            <p>

              {selectedCategory === "all"
                ? "There are currently no pending civic problem reports available for your organization."
                : "There are currently no pending reports in this category."
              }

            </p>

          </div>

        ) : (

          <div className="reports-grid">

            {filteredPendingReports.map(
              (report) => {

                const imageUrl =
                  imageUrls[
                  `pending-${report.id}`
                  ];

                return (

                  <article
                    key={report.id}
                    className="reports-card"
                  >


                    {/* IMAGE */}

                    {report.image && (

                      <div className="reports-card-image-wrapper">

                        {imageUrl ? (

                          <img
                            src={imageUrl}

                            alt={
                              report.title ||
                              "Problem report"
                            }

                            className="reports-card-image"

                            onError={(event) => {

                              event.currentTarget.style.display =
                                "none";

                            }}
                          />

                        ) : (

                          <div className="reports-image-loading">
                            Loading image...
                          </div>

                        )}


                        {/* SEVERITY */}

                        <span
                          className={
                            `reports-severity-badge severity-${(
                              report.severity ||
                              "medium"
                            )
                              .toLowerCase()
                              .trim()}`
                          }
                        >

                          {
                            (
                              report.severity ||
                              "Medium"
                            ).toUpperCase()
                          }

                        </span>

                      </div>

                    )}


                    {/* BODY */}

                    <div className="reports-card-body">


                      {/* CATEGORY + STATUS */}

                      <div className="reports-card-meta-top">

                        <span className="reports-category-tag">

                          {getCategoryName(
                            report
                          )}

                        </span>


                        <span className="reports-status-badge status-pending">

                          {
                            report.status ||
                            "Pending"
                          }

                        </span>

                      </div>


                      {/* TITLE */}

                      <h3>

                        {
                          report.title ||
                          "Untitled Problem"
                        }

                      </h3>


                      {/* DESCRIPTION */}

                      <p className="reports-desc">

                        {
                          report.description ||
                          "No description provided."
                        }

                      </p>


                      {/* LOCATION */}

                      <div className="reports-location-block">

                        <span>

                          📍{" "}

                          {
                            report.location ||
                            "Location unavailable"
                          }

                        </span>


                        {report.latitude != null &&
                          report.longitude != null && (

                            <span className="reports-gps">

                              🌍{" "}

                              {report.latitude},
                              {" "}
                              {report.longitude}

                            </span>

                          )}

                      </div>


                      {/* FOOTER */}

                      <div className="reports-card-footer">


                        <div className="reports-author-info">

                          <small>

                            Reported by:{" "}

                            <strong>

                              {
                                report.reported_by
                                  ?.username ||
                                "Citizen"
                              }

                            </strong>

                          </small>


                          {report.created_at && (

                            <small className="reports-date">

                              {
                                new Date(
                                  report.created_at
                                ).toLocaleDateString()
                              }

                            </small>

                          )}

                        </div>


                        {/* ACCEPT BUTTON */}

                        <div className="reports-action-wrapper">

                          <button
                            type="button"

                            className="btn-accept-report"

                            onClick={() =>
                              handleAcceptReport(
                                report.id
                              )
                            }

                            disabled={
                              actionLoading ===
                              report.id
                            }
                          >

                            {actionLoading ===
                              report.id
                              ? "Accepting..."
                              : "🤝 Accept Report"
                            }

                          </button>

                        </div>

                      </div>

                    </div>

                  </article>

                );
              }
            )}

          </div>

        )}


        {/* ===============================================
            ACCEPTED ASSIGNMENTS
        =============================================== */}

        {acceptedReports.length > 0 && (

          <section className="accepted-reports-section">


            <div className="reports-section-header accepted-header">

              <div>

                <h2>

                  Your Accepted Assignments
                  {" "}
                  ({acceptedReports.length})

                </h2>

                <p>

                  Reports already accepted by your
                  organization.

                </p>

              </div>

            </div>


            <div className="reports-grid">

              {acceptedReports.map(
                (item) => {

                  const problem =
                    item.problem &&
                      typeof item.problem ===
                      "object"
                      ? item.problem
                      : item;


                  const image =
                    problem?.image ||
                    item.image ||
                    null;


                  const imageUrl =
                    imageUrls[
                    `accepted-${item.id}`
                    ];


                  return (

                    <article
                      key={item.id}
                      className="reports-card accepted-report-card"
                    >


                      {/* IMAGE */}

                      {image && (

                        <div className="reports-card-image-wrapper">

                          {imageUrl ? (

                            <img
                              src={imageUrl}

                              alt={
                                problem?.title ||
                                "Accepted report"
                              }

                              className="reports-card-image"

                              onError={(event) => {

                                event.currentTarget.style.display =
                                  "none";

                              }}
                            />

                          ) : (

                            <div className="reports-image-loading">
                              Loading image...
                            </div>

                          )}

                        </div>

                      )}


                      <div className="reports-card-body">


                        {/* CATEGORY + STATUS */}

                        <div className="reports-card-meta-top">

                          <span className="reports-category-tag">

                            {
                              getCategoryName(
                                problem
                              )
                            }

                          </span>


                          <span className="reports-status-badge status-accepted">

                            {
                              item.status ||
                              "Accepted"
                            }

                          </span>

                        </div>


                        {/* TITLE */}

                        <h3>

                          {
                            problem?.title ||
                            item.problem_title ||
                            "Problem Title"
                          }

                        </h3>


                        {/* DESCRIPTION */}

                        <p className="reports-desc">

                          {
                            problem?.description ||
                            item.problem_description ||
                            "No description provided."
                          }

                        </p>


                        {/* LOCATION */}

                        <div className="reports-location-block">

                          <span>

                            📍{" "}

                            {
                              problem?.location ||
                              item.location ||
                              "Location unavailable"
                            }

                          </span>

                        </div>


                        {/* FOOTER */}

                        <div className="reports-card-footer">

                          <div className="reports-author-info">

                            <small>

                              Accepted At:{" "}

                              <strong>

                                {item.accepted_at
                                  ? new Date(
                                    item.accepted_at
                                  ).toLocaleDateString()
                                  : "N/A"
                                }

                              </strong>

                            </small>

                          </div>


                          <span className="badge-accepted-status">

                            ✓ Assigned

                          </span>

                        </div>

                      </div>

                    </article>

                  );
                }
              )}

            </div>

          </section>

        )}

      </main>


      <Footer />

    </div>
  );
};


export default Reports;
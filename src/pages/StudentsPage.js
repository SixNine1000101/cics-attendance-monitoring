import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  query,
  where,
  writeBatch,
  limit,
  orderBy,
  startAfter,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

import BackButton from "../components/BackButton";

// Helper to get a color based on the year
const getYearBadgeColor = (year) => {
  switch (year) {
    case 1:
      return "bg-green-100 text-green-800";
    case 2:
      return "bg-blue-100 text-blue-800";
    case 3:
      return "bg-yellow-100 text-yellow-800";
    case 4:
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

// Main Component
function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Pagination state
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const studentsPerPage = 20;

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [sortBy, setSortBy] = useState("lastName");
  const [sortOrder, setSortOrder] = useState("asc");

  // UI state
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    studentId: "",
    firstName: "",
    lastName: "",
    year: "",
    section: "",
  });
  const [deleteStudent, setDeleteStudent] = useState(null);

  // FIX 1: Remove fetchStudents from dependencies, use refs for current values
  const fetchStudents = useCallback(
    async (loadMore = false) => {
      setLoading(true);
      try {
        let studentsCollectionRef = collection(db, "students");
        let studentsQuery;

        if (searchTerm) {
          // Search behavior: bypass pagination, fetch all matching
          studentsQuery = query(
            studentsCollectionRef,
            orderBy(sortBy, sortOrder),
            where("lastName", ">=", searchTerm.toUpperCase()),
            where("lastName", "<=", searchTerm.toUpperCase() + "\uf8ff")
          );
          if (filterYear !== "all") {
            studentsQuery = query(
              studentsCollectionRef,
              orderBy(sortBy, sortOrder),
              where("lastName", ">=", searchTerm.toUpperCase()),
              where("lastName", "<=", searchTerm.toUpperCase() + "\uf8ff"),
              where("year", "==", Number(filterYear))
            );
          }
          const querySnapshot = await getDocs(studentsQuery);
          const list = querySnapshot.docs.map((docSnap) => ({
            studentId: docSnap.id,
            ...docSnap.data(),
          }));
          setStudents(list);
          setHasMore(false);
        } else {
          // Pagination behavior
          let baseQuery = [studentsCollectionRef];
          
          if (filterYear !== "all") {
            baseQuery.push(where("year", "==", Number(filterYear)));
          }
          
          baseQuery.push(orderBy(sortBy, sortOrder));
          
          if (loadMore && lastVisible) {
            baseQuery.push(startAfter(lastVisible));
          }
          
          baseQuery.push(limit(studentsPerPage));

          studentsQuery = query(...baseQuery);

          const querySnapshot = await getDocs(studentsQuery);
          const newStudents = querySnapshot.docs.map((docSnap) => ({
            studentId: docSnap.id,
            ...docSnap.data(),
          }));

          setStudents((prevStudents) =>
            loadMore ? [...prevStudents, ...newStudents] : newStudents
          );
          
          const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
          setLastVisible(lastDoc);
          setHasMore(newStudents.length === studentsPerPage);
        }
      } catch (error) {
        console.error("Error fetching students:", error);
        setStudents([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, filterYear, sortBy, sortOrder, lastVisible]
  );

  // FIX 2: Separate effect for initial load vs filter changes
  // This prevents the circular dependency
  useEffect(() => {
    let isMounted = true;
    
    const loadStudents = async () => {
      if (!isMounted) return;
      
      setStudents([]);
      setLastVisible(null);
      setHasMore(true);
      
      try {
        let studentsCollectionRef = collection(db, "students");
        let studentsQuery;

        if (searchTerm) {
          studentsQuery = query(
            studentsCollectionRef,
            orderBy(sortBy, sortOrder),
            where("lastName", ">=", searchTerm.toUpperCase()),
            where("lastName", "<=", searchTerm.toUpperCase() + "\uf8ff")
          );
          if (filterYear !== "all") {
            studentsQuery = query(
              studentsCollectionRef,
              orderBy(sortBy, sortOrder),
              where("lastName", ">=", searchTerm.toUpperCase()),
              where("lastName", "<=", searchTerm.toUpperCase() + "\uf8ff"),
              where("year", "==", Number(filterYear))
            );
          }
          const querySnapshot = await getDocs(studentsQuery);
          const list = querySnapshot.docs.map((docSnap) => ({
            studentId: docSnap.id,
            ...docSnap.data(),
          }));
          if (isMounted) {
            setStudents(list);
            setHasMore(false);
            setLoading(false);
          }
        } else {
          let baseQuery = [studentsCollectionRef];
          
          if (filterYear !== "all") {
            baseQuery.push(where("year", "==", Number(filterYear)));
          }
          
          baseQuery.push(orderBy(sortBy, sortOrder));
          baseQuery.push(limit(studentsPerPage));

          studentsQuery = query(...baseQuery);

          const querySnapshot = await getDocs(studentsQuery);
          const newStudents = querySnapshot.docs.map((docSnap) => ({
            studentId: docSnap.id,
            ...docSnap.data(),
          }));

          if (isMounted) {
            setStudents(newStudents);
            const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
            setLastVisible(lastDoc);
            setHasMore(newStudents.length === studentsPerPage);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching students:", error);
        if (isMounted) {
          setStudents([]);
          setHasMore(false);
          setLoading(false);
        }
      }
    };

    loadStudents();
    
    return () => {
      isMounted = false;
    };
  }, [searchTerm, filterYear, sortBy, sortOrder]);

  // Click outside handler for kebab menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // FIX 3: Separate load more function
  const handleLoadMore = async () => {
    if (!lastVisible || loading) return;
    
    setLoading(true);
    try {
      let studentsCollectionRef = collection(db, "students");
      let baseQuery = [studentsCollectionRef];
      
      if (filterYear !== "all") {
        baseQuery.push(where("year", "==", Number(filterYear)));
      }
      
      baseQuery.push(orderBy(sortBy, sortOrder));
      baseQuery.push(startAfter(lastVisible));
      baseQuery.push(limit(studentsPerPage));

      const studentsQuery = query(...baseQuery);
      const querySnapshot = await getDocs(studentsQuery);
      const newStudents = querySnapshot.docs.map((docSnap) => ({
        studentId: docSnap.id,
        ...docSnap.data(),
      }));

      setStudents((prev) => [...prev, ...newStudents]);
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(newStudents.length === studentsPerPage);
    } catch (error) {
      console.error("Error loading more students:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Data Handlers ---
  const handleSave = async () => {
    if (
      !formData.studentId ||
      !formData.firstName ||
      !formData.lastName ||
      !formData.year ||
      !formData.section
    ) {
      alert("All fields are required.");
      return;
    }
    
    try {
      const studentData = {
        firstName: formData.firstName.toUpperCase(),
        lastName: formData.lastName.toUpperCase(),
        year: Number(formData.year),
        section: formData.section.toUpperCase(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, "students", formData.studentId.toUpperCase()), studentData, {
        merge: true,
      });

      const today = new Date().toISOString().split("T")[0];
      const eventsQuery = query(collection(db, "events"), where("date", ">=", today));
      const eventsSnapshot = await getDocs(eventsQuery);
      eventsSnapshot.forEach((eventDoc) => {
        const attendanceRef = doc(
          db,
          `events/${eventDoc.id}/attendance`,
          formData.studentId.toUpperCase()
        );
        batch.set(attendanceRef, studentData, { merge: true });
      });

      await batch.commit();
      closeModal();
      
      // Reset and refetch
      setStudents([]);
      setLastVisible(null);
      setHasMore(true);
    } catch (error) {
      console.error("Error saving student:", error);
      alert("Failed to save student. Please try again.");
    }
  };

  const handleDelete = async (studentId) => {
    try {
      await deleteDoc(doc(db, "students", studentId));

      const today = new Date().toISOString().split("T")[0];
      const eventsQuery = query(collection(db, "events"), where("date", ">=", today));
      const eventsSnapshot = await getDocs(eventsQuery);
      for (const eventDoc of eventsSnapshot.docs) {
        await deleteDoc(doc(db, "events", eventDoc.id, "attendance", studentId));
      }
      
      setDeleteStudent(null);
      
      // Reset and refetch
      setStudents([]);
      setLastVisible(null);
      setHasMore(true);
    } catch (error) {
      console.error("Error deleting student:", error);
      alert("Failed to delete student. Please try again.");
    }
  };

  // --- Modal Controls ---
  const openModal = (student = null) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        year: student.year,
        section: student.section,
      });
    } else {
      setEditingStudent(null);
      setFormData({ studentId: "", firstName: "", lastName: "", year: "", section: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
  };

  const openDeleteModal = (student) => {
    setDeleteStudent(student);
  };

  // FIX 4: Remove redundant client-side filtering since Firestore handles it
  const displayedStudents = students;

  // --- Render Components ---

  const YearBadge = ({ year }) => (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${getYearBadgeColor(
        year
      )}`}
    >
      Year {year}
    </span>
  );

  const KebabMenu = ({ student }) => (
    <div className="relative" ref={activeMenu === student.studentId ? menuRef : null}>
      <button onClick={() => setActiveMenu(activeMenu === student.studentId ? null : student.studentId)}>
        <EllipsisVerticalIcon className="h-6 w-6 text-gray-500 hover:text-gray-800" />
      </button>
      {activeMenu === student.studentId && (
        <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 border border-gray-100">
          <button
            onClick={() => {
              openModal(student);
              setActiveMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <PencilIcon className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={() => {
              openDeleteModal(student);
              setActiveMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <TrashIcon className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white shadow-md p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Back Button */}
          <BackButton />
          <h1 className="text-2xl font-bold text-gray-800">Manage Students</h1>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 flex items-center gap-2 transition"
          title="Add Student"
        >
          <UserPlusIcon className="h-5 w-5" />
          <span className="hidden md:inline">Add Student</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="sticky top-[72px] z-10 bg-white/80 backdrop-blur-sm p-4 shadow-sm border-b border-gray-200 mb-6">
        {/* Mobile Toolbar */}
        <div className="flex md:hidden gap-2">
          <div className="relative flex-grow">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name or ID..."
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsFilterDrawerOpen(true)}
            className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition"
          >
            <FunnelIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Desktop Toolbar */}
        <div className="hidden md:flex gap-4 items-center">
          <div className="relative flex-grow">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name or ID..."
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            <option value="all">All Years</option>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="lastName">Sort by Last Name</option>
            <option value="firstName">Sort by First Name</option>
            <option value="year">Sort by Year</option>
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <div className="p-4 md:p-8 pt-0">
        {loading && students.length === 0 ? (
          <p className="text-center text-gray-500">Loading students...</p>
        ) : (
          <>
            {/* VIEW 1: DESKTOP TABLE */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="bg-gray-50 text-xs text-gray-700 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Student ID</th>
                    <th className="px-6 py-3">Year & Section</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-gray-500">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map((s) => (
                      <tr key={s.studentId} className="odd:bg-white even:bg-gray-50 border-t">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {s.lastName}, {s.firstName}
                        </td>
                        <td className="px-6 py-4">{s.studentId}</td>
                        <td className="px-6 py-4 flex items-center gap-2">
                          <YearBadge year={s.year} />
                          <span className="font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md text-xs">
                            {s.section}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <KebabMenu student={s} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* VIEW 2: MOBILE CARD STACK */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {displayedStudents.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No students found.</p>
              ) : (
                displayedStudents.map((s) => (
                  <div
                    key={s.studentId}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="font-bold text-gray-800">
                        {s.lastName}, {s.firstName}
                      </p>
                      <p className="text-sm text-gray-500">{s.studentId}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <YearBadge year={s.year} />
                        <span className="font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md text-xs">
                          {s.section}
                        </span>
                      </div>
                    </div>
                    <KebabMenu student={s} />
                  </div>
                ))
              )}
            </div>

            {hasMore && !searchTerm && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={handleLoadMore}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile Filter Drawer */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-40 flex justify-end">
          <div className="bg-white w-80 h-full shadow-lg p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Filter & Sort</h3>
              <button onClick={() => setIsFilterDrawerOpen(false)}>
                <XMarkIcon className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="all">All Years</option>
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="lastName">Last Name</option>
                <option value="firstName">First Name</option>
                <option value="year">Year</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort Order
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>

            <button
              onClick={() => setIsFilterDrawerOpen(false)}
              className="mt-auto bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* --- Modals (Add/Edit Student) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">
              {editingStudent ? "Edit Student" : "Add Student"}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Student ID"
                className="w-full border rounded px-3 py-2 uppercase"
                value={formData.studentId}
                onChange={(e) =>
                  setFormData({ ...formData, studentId: e.target.value })
                }
                disabled={!!editingStudent}
              />
              <input
                type="text"
                placeholder="First Name"
                className="w-full border rounded px-3 py-2 uppercase"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Last Name"
                className="w-full border rounded px-3 py-2 uppercase"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
              />
              <select
                className="w-full border rounded px-3 py-2"
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: e.target.value })
                }
              >
                <option value="">Select Year</option>
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Section"
                className="w-full border rounded px-3 py-2 uppercase"
                value={formData.section}
                onChange={(e) =>
                  setFormData({ ...formData, section: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modals (Delete Student) --- */}
      {deleteStudent && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-2 text-red-600">
              Confirm Deletion
            </h3>
            <p className="text-gray-700 mb-6">
              Delete{" "}
              <span className="font-bold">
                {deleteStudent.firstName} {deleteStudent.lastName}
              </span>{" "}
              (ID: {deleteStudent.studentId})? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteStudent(null)}
                className="px-4 py-2 bg-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteStudent.studentId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentsPage;
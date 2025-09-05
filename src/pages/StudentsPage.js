import React, { useEffect, useState } from "react";
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState(null);

    // Search/filter/sort
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("nameAsc");
    const [groupOption, setGroupOption] = useState("none");
    const [filterYear, setFilterYear] = useState("all");
    const [filterSection, setFilterSection] = useState("all");

    // Scroll-to-top
    const [showScrollTop, setShowScrollTop] = useState(false);

    // Modal state
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


    // Auth guard
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const tokenResult = await user.getIdTokenResult();
                setRole(tokenResult.claims.role || null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Fetch students
    const fetchStudents = async () => {
        const querySnapshot = await getDocs(collection(db, "students"));
        const list = [];
        querySnapshot.forEach((docSnap) => {
            list.push({ studentId: docSnap.id, ...docSnap.data() });
        });

        setStudents(list);
        setLoading(false);
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    // Scroll button
    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 300);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    const scrollToTop = () =>
        window.scrollTo({ top: 0, behavior: "smooth" });

    // Save student
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

        // If editing, update existing doc; else create new doc with studentId as key
        await setDoc(doc(db, "students", formData.studentId), {
            firstName: formData.firstName,
            lastName: formData.lastName,
            year: Number(formData.year),
            section: formData.section,
        }, { merge: true }); // merge = update existing or create if new

        setIsModalOpen(false);
        setEditingStudent(null);
        setFormData({
            studentId: "",
            firstName: "",
            lastName: "",
            year: "",
            section: "",
        });
        fetchStudents();
    };
    // Delete student
    const openDeleteModal = (student) => {
        setDeleteStudent(student);
    };



    const openEditModal = (student) => {
        setEditingStudent(student);
        setFormData({
            studentId: student.studentId,
            firstName: student.firstName,
            lastName: student.lastName,
            year: student.year,
            section: student.section,
        });
        setIsModalOpen(true);
    };

    // Available sections
    const availableSections = () => {
        if (filterYear === "all") return [];
        const sections = students
            .filter((s) => s.year === Number(filterYear))
            .map((s) => s.section);
        return Array.from(new Set(sections)).sort();
    };

    // Apply search & filters
    let filtered = students
        .filter((s) =>
            [
                s.firstName || "",
                s.lastName || "",
                s.studentId || ""
            ].some((field) =>
                field.toLowerCase().includes(searchTerm.toLowerCase())
            )
        )
        .filter((s) => {
            if (filterYear !== "all" && s.year !== Number(filterYear)) return false;
            if (filterSection !== "all" && s.section !== filterSection) return false;
            return true;
        });

    // Sorting
    filtered.sort((a, b) => {
        switch (sortOption) {
            case "nameAsc":
                return a.lastName.localeCompare(b.lastName);
            case "nameDesc":
                return b.lastName.localeCompare(a.lastName);
            case "yearAsc":
                return a.year - b.year;
            case "yearDesc":
                return b.year - a.year;
            default:
                return 0;
        }
    });

    // Table renderer
    const renderTable = (list) => (
        <div className="overflow-x-auto rounded-lg shadow bg-white">
            <table className="w-full text-sm">
                <thead className="bg-gray-200 text-gray-700">
                    <tr>
                        <th className="px-4 py-2">Student ID</th>
                        <th className="px-4 py-2">Last Name</th>
                        <th className="px-4 py-2">First Name</th>
                        <th className="px-4 py-2">Year</th>
                        <th className="px-4 py-2">Section</th>
                        <th className="px-4 py-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((s) => (
                        <tr key={s.studentId} className="border-t">
                            <td className="px-4 py-2">{s.studentId}</td>
                            <td className="px-4 py-2">{s.lastName}</td>
                            <td className="px-4 py-2">{s.firstName}</td>
                            <td className="px-4 py-2">Year {s.year}</td>
                            <td className="px-4 py-2">Section {s.section}</td>
                            <td className="px-4 py-2 flex gap-2">
                                <button
                                    className="bg-blue-600 text-white px-3 ml-auto py-1 rounded hover:bg-blue-700"
                                    onClick={() => openEditModal(s)}
                                >
                                    Edit
                                </button>
                                <button
                                    className="bg-red-600 text-white px-3 mr-auto py-1 rounded hover:bg-red-700"
                                    onClick={() => openDeleteModal(s)}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    // Grouped renderer
    const renderGrouped = () => {
        if (groupOption === "year") {
            const years = Array.from(new Set(filtered.map((s) => s.year))).sort();
            return years.map((year) => (
                <div key={year} className="mb-8">
                    <h3 className="text-xl font-bold mb-3">Year {year}</h3>
                    {renderTable(filtered.filter((s) => s.year === year))}
                </div>
            ));
        }

        if (groupOption === "yearSection") {
            const years = Array.from(new Set(filtered.map((s) => s.year))).sort();
            return years.map((year) => {
                const sections = Array.from(
                    new Set(filtered.filter((s) => s.year === year).map((s) => s.section))
                ).sort();
                return (
                    <div key={year} className="mb-8">
                        <h3 className="text-xl font-bold mb-3">Year {year}</h3>
                        {sections.map((section) => (
                            <div
                                key={section}
                                className="mb-6 pl-4 border-l-4 border-blue-500"
                            >
                                <h4 className="text-lg font-semibold mb-2">
                                    Section {section}
                                </h4>
                                {renderTable(
                                    filtered.filter(
                                        (s) => s.year === year && s.section === section
                                    )
                                )}
                            </div>
                        ))}
                    </div>
                );
            });
        }

        return renderTable(filtered);
    };

    if (role !== "admin") {
        return (
            <p className="text-center text-gray-600 mt-10">
                Unauthorized – Admins only
            </p>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Manage Students</h2>

            {/* Toolbar */}
            {/* search/sort/filter/add */}
            <div className="flex flex-wrap gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search by ID or Name..."
                    className="border border-gray-300 rounded-lg px-4 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                <select
                    className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                >
                    <option value="nameAsc">Sort: Last Name A–Z</option>
                    <option value="nameDesc">Sort: Last Name Z–A</option>
                    <option value="yearAsc">Sort: Year ↑</option>
                    <option value="yearDesc">Sort: Year ↓</option>
                </select>

                <select
                    className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
                    value={filterYear}
                    onChange={(e) => {
                        setFilterYear(e.target.value);
                        setFilterSection("all");
                    }}
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
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    disabled={filterYear === "all" || availableSections().length === 0}
                >
                    <option value="all">All Sections</option>
                    {availableSections().map((s) => (
                        <option key={s} value={s}>
                            Section {s}
                        </option>
                    ))}
                </select>

                <select
                    className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
                    value={groupOption}
                    onChange={(e) => setGroupOption(e.target.value)}
                >
                    <option value="none">Group: None</option>
                    <option value="year">Group: By Year</option>
                    <option value="yearSection">Group: By Year & Section</option>
                </select>

                <button
                    className="bg-green-600 text-white px-4 py-2 ml-auto rounded-lg shadow hover:bg-green-700"
                    onClick={() => {
                        setEditingStudent(null);
                        setFormData({
                            studentId: "",
                            firstName: "",
                            lastName: "",
                            year: "",
                            section: "",
                        });
                        setIsModalOpen(true);
                    }}
                >
                    + Add Student
                </button>

            </div>

            {loading ? (
                <p className="text-gray-500 text-center">Loading students...</p>
            ) : (
                renderGrouped()
            )}

            {/* Scroll to top button */}
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-6 left-6 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700"
                >
                    ↑ Top
                </button>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
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
                                disabled={!!editingStudent} // lock field if editing
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
                                onClick={() => setIsModalOpen(false)}
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

            {deleteStudent && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
                        <h3 className="text-xl font-semibold mb-4 text-red-600">Confirm Delete</h3>
                        <p className="text-gray-700 mb-0">
                            Are you sure you want to delete{" "}
                        </p>
                        <p className="text-gray-700 mb-6">
                            <span className="font-bold">
                                {deleteStudent.firstName} {deleteStudent.lastName}
                            </span>{" "}
                            (ID: {deleteStudent.studentId})?
                        </p>
                        {/* <p className="text-sm text-gray-400 mb-4 italic ">
                            This action cannot be undone.
                        </p> */}

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteStudent(null)}
                                className="px-4 py-2 bg-gray-300 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    await deleteDoc(doc(db, "students", deleteStudent.id));
                                    setDeleteStudent(null);
                                    fetchStudents();
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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

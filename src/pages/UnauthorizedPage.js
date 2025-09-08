function UnauthorizedPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold mb-4 text-red-600">Access Denied</h2>
        <p className="text-gray-700">You do not have permission to view this page.</p>
        <p className="text-gray-700">Please contact your administrator. 
          <a href="/events" className="ml-2 text-blue-600 hover:underline">
            return
          </a>
        </p>

      </div>
    </div>
  );
}

export default UnauthorizedPage;

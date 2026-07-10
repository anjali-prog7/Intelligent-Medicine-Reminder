import Layout from "../components/Layout";
import {
  FaCapsules,
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

function Medicines() {
  return (
    <Layout>

      {/* Heading */}

      <div className="flex justify-between items-center mb-8">

        <div>

          <h1 className="text-4xl font-bold text-gray-800">
            Medicines
          </h1>

          <p className="text-gray-500 mt-2">
            Manage all your medicines here
          </p>

        </div>

        <button className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl flex items-center gap-2">

          <FaPlus />

          Add Medicine

        </button>

      </div>

      {/* Search */}

      <div className="relative w-full md:w-96 mb-8">

        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

        <input
          type="text"
          placeholder="Search medicine..."
          className="w-full bg-white rounded-xl border border-gray-200 shadow py-3 pl-12 pr-4 outline-none"
        />

      </div>

      {/* Table */}

      <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

        <table className="w-full">

          <thead className="bg-teal-600 text-white">

            <tr>

              <th className="p-4 text-left">
                Medicine
              </th>

              <th className="p-4 text-left">
                Dosage
              </th>

              <th className="p-4 text-left">
                Time
              </th>

              <th className="p-4 text-center">
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            <tr className="border-b">

              <td className="p-4 flex items-center gap-3">

                <FaCapsules className="text-teal-600" />

                Paracetamol

              </td>

              <td className="p-4">
                500 mg
              </td>

              <td className="p-4">
                Morning
              </td>

              <td className="p-4">

                <div className="flex justify-center gap-4">

                  <button className="text-blue-600 hover:text-blue-800">

                    <FaEdit />

                  </button>

                  <button className="text-red-600 hover:text-red-800">

                    <FaTrash />

                  </button>

                </div>

              </td>

            </tr>

            <tr className="border-b">

              <td className="p-4 flex items-center gap-3">

                <FaCapsules className="text-teal-600" />

                Vitamin C

              </td>

              <td className="p-4">
                1 Tablet
              </td>

              <td className="p-4">
                Afternoon
              </td>

              <td className="p-4">

                <div className="flex justify-center gap-4">

                  <button className="text-blue-600 hover:text-blue-800">

                    <FaEdit />

                  </button>

                  <button className="text-red-600 hover:text-red-800">

                    <FaTrash />

                  </button>

                </div>

              </td>

            </tr>

          </tbody>

        </table>

      </div>

    </Layout>
  );
}

export default Medicines;
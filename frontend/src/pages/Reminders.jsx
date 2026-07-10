import Layout from "../components/Layout";
import {
  FaBell,
  FaPlus,
  FaClock,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

function Reminders() {
  return (
    <Layout>

      {/* Heading */}

      <div className="flex justify-between items-center mb-8">

        <div>

          <h1 className="text-4xl font-bold text-gray-800">
            Reminders
          </h1>

          <p className="text-gray-500 mt-2">
            Manage your medicine reminders
          </p>

        </div>

        <button className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl flex items-center gap-2">

          <FaPlus />

          Add Reminder

        </button>

      </div>

      {/* Reminder Cards */}

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Card 1 */}

        <div className="bg-white rounded-3xl shadow-lg p-6">

          <div className="flex justify-between items-center">

            <div>

              <h2 className="text-2xl font-bold">
                Paracetamol
              </h2>

              <p className="text-gray-500 mt-2">
                Morning Dose
              </p>

            </div>

            <FaBell className="text-4xl text-teal-600" />

          </div>

          <div className="mt-6 flex items-center gap-3">

            <FaClock className="text-orange-500" />

            <span className="font-semibold">
              09:00 AM
            </span>

          </div>

          <div className="flex justify-end gap-4 mt-8">

            <button className="text-blue-600 hover:text-blue-800">

              <FaEdit />

            </button>

            <button className="text-red-600 hover:text-red-800">

              <FaTrash />

            </button>

          </div>

        </div>

        {/* Card 2 */}

        <div className="bg-white rounded-3xl shadow-lg p-6">

          <div className="flex justify-between items-center">

            <div>

              <h2 className="text-2xl font-bold">
                Vitamin C
              </h2>

              <p className="text-gray-500 mt-2">
                Afternoon Dose
              </p>

            </div>

            <FaBell className="text-4xl text-orange-500" />

          </div>

          <div className="mt-6 flex items-center gap-3">

            <FaClock className="text-blue-500" />

            <span className="font-semibold">
              02:00 PM
            </span>

          </div>

          <div className="flex justify-end gap-4 mt-8">

            <button className="text-blue-600 hover:text-blue-800">

              <FaEdit />

            </button>

            <button className="text-red-600 hover:text-red-800">

              <FaTrash />

            </button>

          </div>

        </div>

        {/* Card 3 */}

        <div className="bg-white rounded-3xl shadow-lg p-6">

          <div className="flex justify-between items-center">

            <div>

              <h2 className="text-2xl font-bold">
                Calcium
              </h2>

              <p className="text-gray-500 mt-2">
                Night Dose
              </p>

            </div>

            <FaBell className="text-4xl text-blue-600" />

          </div>

          <div className="mt-6 flex items-center gap-3">

            <FaClock className="text-green-600" />

            <span className="font-semibold">
              09:00 PM
            </span>

          </div>

          <div className="flex justify-end gap-4 mt-8">

            <button className="text-blue-600 hover:text-blue-800">

              <FaEdit />

            </button>

            <button className="text-red-600 hover:text-red-800">

              <FaTrash />

            </button>

          </div>

        </div>

      </div>

    </Layout>
  );
}

export default Reminders;
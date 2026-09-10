import { FaEdit, FaTrash } from "react-icons/fa";

export default function CollectorsTable({
  collectors,
  onEdit,
  onDelete,
}) {
  if (collectors.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
        <h2 className="text-xl font-semibold text-gray-700">
          No Collectors Found
        </h2>

        <p className="text-gray-500 mt-2">
          Add your first collector to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">

      <table className="w-full min-w-[900px]">

        <thead className="bg-gray-100">

          <tr>
            <th className="p-4 text-left">Name</th>
            <th className="p-4 text-left">Mobile</th>
            <th className="p-4 text-left">Area</th>
            <th className="p-4 text-left">Vehicle</th>
            <th className="p-4 text-left">Status</th>
            <th className="p-4 text-center">Actions</th>
          </tr>

        </thead>

        <tbody>

          {collectors.map((collector) => (

            <tr
              key={collector.id}
              className="border-t hover:bg-gray-50 transition"
            >

              <td className="p-4 font-semibold">
                {collector.name}
              </td>

              <td className="p-4">
                {collector.mobile}
              </td>

              <td className="p-4">
                {collector.area}
              </td>

              <td className="p-4">
                {collector.vehicle}
              </td>

              <td className="p-4">

                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    collector.status === "Active"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {collector.status}
                </span>

              </td>

              <td className="p-4">

                <div className="flex justify-center gap-4">

                  <button
                    onClick={() => onEdit(collector)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <FaEdit />
                  </button>

                  <button
                    onClick={() => onDelete(collector.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <FaTrash />
                  </button>

                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}
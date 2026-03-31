import { Trash2, Plus } from 'lucide-react';
import type { GpuConfig } from '../lib/compute';

interface Props {
  configs: GpuConfig[];
  onChange: (configs: GpuConfig[]) => void;
}

export default function GpuConfigTable({ configs, onChange }: Props) {
  const update = (id: string, field: keyof GpuConfig, value: string | number) => {
    onChange(configs.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const addRow = () => {
    onChange([...configs, {
      id: crypto.randomUUID(),
      label: 'New Config',
      num_gpus: 4,
      usd_per_hour: 0.50,
      mhz: 1.0,
    }]);
  };

  const deleteRow = (id: string) => {
    onChange(configs.filter(c => c.id !== id));
  };

  const inputCls = "w-full bg-[#0a0f1e] border border-gray-700 rounded px-1 py-0.5 text-gray-100 font-mono text-xs focus:outline-none focus:border-cyan-500";

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left pb-1 font-medium" title="Display name for this GPU scenario in charts and tables.">Label</th>
              <th className="text-left pb-1 font-medium px-1" title="Number of GPUs in this configuration.">#</th>
              <th className="text-left pb-1 font-medium px-1" title="Hourly rental cost per GPU in USD.">$/hr</th>
              <th className="text-left pb-1 font-medium px-1" title="Throughput per GPU in MHz (million cycles/second).">MHz</th>
              <th className="pb-1"></th>
            </tr>
          </thead>
          <tbody>
            {configs.map(c => (
              <tr key={c.id} className="border-b border-gray-800">
                <td className="py-1 pr-1">
                  <input
                    className={inputCls}
                    value={c.label}
                    onChange={e => update(c.id, 'label', e.target.value)}
                  />
                </td>
                <td className="py-1 px-1">
                  <input
                    className={inputCls + " w-10"}
                    type="number"
                    min={1}
                    value={c.num_gpus}
                    onChange={e => update(c.id, 'num_gpus', Number(e.target.value))}
                  />
                </td>
                <td className="py-1 px-1">
                  <input
                    className={inputCls + " w-14"}
                    type="number"
                    min={0}
                    step={0.01}
                    value={c.usd_per_hour}
                    onChange={e => update(c.id, 'usd_per_hour', Number(e.target.value))}
                  />
                </td>
                <td className="py-1 px-1">
                  <input
                    className={inputCls + " w-14"}
                    type="number"
                    min={0}
                    step={0.1}
                    value={c.mhz}
                    onChange={e => update(c.id, 'mhz', Number(e.target.value))}
                  />
                </td>
                <td className="py-1 pl-1">
                  <button
                    onClick={() => deleteRow(c.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="mt-2 flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        <Plus size={12} /> Add config
      </button>
    </div>
  );
}

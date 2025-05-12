import React from 'react';
import { PayrollSummaryModel } from '@/renderer/model/payroll';
import { PayrollList } from '@/renderer/components/PayrollList';
import { PayrollSummary } from '@/renderer/components/PayrollSummary';
import NoDataPlaceholder from '@/renderer/components/NoDataPlaceholder';

interface PayrollViewProps {
  selectedEmployeeId: string | null;
  payrollSummary: PayrollSummaryModel | null;
  payrollListProps: any;
  onCloseSummary: () => void;
  canEdit: boolean;
  onNavigate: (path: string) => void;
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  selectedEmployeeId,
  payrollSummary,
  payrollListProps,
  onCloseSummary,
  canEdit,
  onNavigate
}) => {
  return (
    <div className="relative z-10">
      {payrollSummary ? (
        <PayrollSummary
          data={payrollSummary}
          onClose={onCloseSummary}
          canEdit={canEdit}
        />
      ) : (
        selectedEmployeeId === null ? (
          <NoDataPlaceholder
            dataType="payroll details"
            actionText="Select Employee"
            onActionClick={() => onNavigate("/")}
            onSelectEmployeeClick={() => onNavigate("/")}
          />
        ) : (
          <PayrollList {...payrollListProps} />
        )
      )}
    </div>
  );
}; 